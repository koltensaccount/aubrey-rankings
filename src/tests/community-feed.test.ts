import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, collections, ratings, follows, likes, savedRankings, comments, mediaItems } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("Stage 19: Phase 5 — Community Feed, Profiles, and Discovery", () => {
  const userAId = `user_feed_a_${Date.now()}`;
  const userBId = `user_feed_b_${Date.now()}`;
  const userCId = `user_feed_c_${Date.now()}`;

  const mediaItem1Id = `media_feed_1_${Date.now()}`;
  const mediaItem2Id = `media_feed_2_${Date.now()}`;

  const publicColBId = `col_feed_pub_b_${Date.now()}`;
  const privateColCId = `col_feed_priv_c_${Date.now()}`;
  const unlistedColCId = `col_feed_unlist_c_${Date.now()}`;

  const ratingBId = `rat_feed_b_${Date.now()}`;
  const ratingCId = `rat_feed_c_${Date.now()}`;

  before(async () => {
    // 1. Setup test users
    await db.insert(user).values([
      {
        id: userAId,
        name: "Observer Critic",
        username: `observer_${Date.now().toString().slice(-6)}`,
        email: `${userAId}@example.com`,
      },
      {
        id: userBId,
        name: "Active Creator",
        username: `creator_${Date.now().toString().slice(-6)}`,
        email: `${userBId}@example.com`,
      },
      {
        id: userCId,
        name: "Private Critic",
        username: `private_${Date.now().toString().slice(-6)}`,
        email: `${userCId}@example.com`,
      },
    ]);

    // 2. Setup test media items
    await db.insert(mediaItems).values([
      {
        id: mediaItem1Id,
        title: "San Junipero",
        mediaType: "episode",
        seasonNumber: 3,
        episodeNumber: 4,
      },
      {
        id: mediaItem2Id,
        title: "White Christmas",
        mediaType: "episode",
        seasonNumber: 2,
        episodeNumber: 4,
      },
    ]);

    // 3. Setup collections:
    // B has public collection
    await db.insert(collections).values({
      id: publicColBId,
      userId: userBId,
      title: "Anthology Highlights",
      collectionType: "tv_show",
      visibility: "public",
      isPublic: true,
    });

    // C has private collection and unlisted collection
    await db.insert(collections).values([
      {
        id: privateColCId,
        userId: userCId,
        title: "Draft Private Scratchpad",
        collectionType: "custom",
        visibility: "private",
        isPublic: false,
      },
      {
        id: unlistedColCId,
        userId: userCId,
        title: "Direct Link Only Canon",
        collectionType: "custom",
        visibility: "unlisted",
        isPublic: false,
      },
    ]);
  });

  after(async () => {
    // Clean up test data
    await db.delete(comments).where(eq(comments.collectionId, publicColBId));
    await db.delete(likes).where(eq(likes.collectionId, publicColBId));
    await db.delete(savedRankings).where(eq(savedRankings.collectionId, publicColBId));
    await db.delete(ratings).where(inArray(ratings.id, [ratingBId, ratingCId]));
    await db.delete(collections).where(inArray(collections.id, [publicColBId, privateColCId, unlistedColCId]));
    await db.delete(follows).where(eq(follows.followerId, userAId));
    await db.delete(mediaItems).where(inArray(mediaItems.id, [mediaItem1Id, mediaItem2Id]));
    await db.delete(user).where(inArray(user.id, [userAId, userBId, userCId]));
  });

  it("1. Following Feed: A follows B, B publishes a ranking, A sees it in Following", async () => {
    // A follows B
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userAId,
      followingId: userBId,
    });

    // Directly test feed logic for following
    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userAId));
    const followingIds = followingRows.map((r) => r.followingId);

    assert.ok(followingIds.includes(userBId), "A must be following B");

    const followedCollections = await db.query.collections.findMany({
      where: (c, { and, inArray, eq }) =>
        and(inArray(c.userId, followingIds), eq(c.visibility, "public")),
      with: { user: true },
    });

    assert.ok(
      followedCollections.some((c) => c.id === publicColBId),
      "A must see B's public ranking in Following feed"
    );
  });

  it("2. Published Reviews in Feed: B publishes an episode review, A sees it in Following", async () => {
    // B rates episode 1 on public collection with review text and private notes
    await db.insert(ratings).values({
      id: ratingBId,
      userId: userBId,
      mediaItemId: mediaItem1Id,
      collectionId: publicColBId,
      reviewText: "San Junipero remains the emotional high watermark of speculative anthology television.",
      personalNotes: "DO NOT LEAK THIS PRIVATE NOTE",
      calculatedOverallScore: 9.8,
    });

    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userAId));
    const followingIds = followingRows.map((r) => r.followingId);

    // Query published reviews for accounts followed by A
    const reviewsInFeed = await db.query.ratings.findMany({
      where: (r, { and, inArray, isNotNull, ne }) =>
        and(
          inArray(r.userId, followingIds),
          isNotNull(r.reviewText),
          ne(r.reviewText, ""),
          isNotNull(r.collectionId)
        ),
      columns: {
        personalNotes: false,
      },
      with: {
        user: true,
        mediaItem: true,
        collection: true,
      },
    });

    const publicReviewsInFeed = reviewsInFeed.filter(
      (r) => r.collection && r.collection.visibility === "public"
    );

    const targetReview = publicReviewsInFeed.find((r) => r.id === ratingBId);
    assert.ok(targetReview, "A must see B's published episode review in Following feed");
    assert.equal(targetReview.mediaItem.title, "San Junipero");
    assert.ok(targetReview.reviewText && targetReview.reviewText.includes("emotional high watermark"));
    assert.equal((targetReview as any).personalNotes, undefined, "Private notes must never be exposed");
  });

  it("3. Unfollow Action: A unfollows B, B's activity disappears from A's Following feed", async () => {
    // A unfollows B
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, userAId), eq(follows.followingId, userBId)));

    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userAId));
    const followingIds = followingRows.map((r) => r.followingId);

    assert.equal(followingIds.length, 0, "A should have no followings");

    // Any query filtered by followingIds will now return empty
    const followedCollections = followingIds.length
      ? await db.query.collections.findMany({
          where: (c, { and, inArray, eq }) =>
            and(inArray(c.userId, followingIds), eq(c.visibility, "public")),
        })
      : [];

    assert.equal(
      followedCollections.some((c) => c.id === publicColBId),
      false,
      "B's ranking must disappear immediately upon unfollowing"
    );
  });

  it("4. Privacy Boundaries: Private and unlisted content NEVER appears in public discovery", async () => {
    // C writes a review on a private collection
    await db.insert(ratings).values({
      id: ratingCId,
      userId: userCId,
      mediaItemId: mediaItem2Id,
      collectionId: privateColCId,
      reviewText: "Secret critique of White Christmas.",
      personalNotes: "Top secret",
    });

    // Query Discover rankings (public collections only)
    const discoverCollections = await db.query.collections.findMany({
      where: (c, { eq }) => eq(c.visibility, "public"),
    });

    assert.equal(
      discoverCollections.some((c) => c.id === privateColCId),
      false,
      "Private collections must never appear in Discover feed"
    );
    assert.equal(
      discoverCollections.some((c) => c.id === unlistedColCId),
      false,
      "Unlisted collections must never appear in Discover feed"
    );

    // Query Discover reviews (reviews in public collections only)
    const rawRatings = await db.query.ratings.findMany({
      where: (r, { and, isNotNull, ne }) =>
        and(isNotNull(r.reviewText), ne(r.reviewText, ""), isNotNull(r.collectionId)),
      with: { collection: true },
    });

    const discoverReviews = rawRatings.filter(
      (r) => r.collection && r.collection.visibility === "public"
    );

    assert.equal(
      discoverReviews.some((r) => r.id === ratingCId),
      false,
      "Reviews attached to private collections must never appear in public discovery"
    );
  });

  it("5. Engagement Aggregates: ranking cards report actual like, save, and comment counts", async () => {
    // Add 1 like, 1 save, 1 comment to B's public collection
    await db.insert(likes).values({
      id: randomUUID(),
      userId: userAId,
      collectionId: publicColBId,
    });

    await db.insert(savedRankings).values({
      id: randomUUID(),
      userId: userAId,
      collectionId: publicColBId,
    });

    await db.insert(comments).values({
      id: randomUUID(),
      userId: userAId,
      collectionId: publicColBId,
      content: "Excellent curation.",
    });

    const totalLikes = (
      await db.query.likes.findMany({ where: (l, { eq }) => eq(l.collectionId, publicColBId) })
    ).length;

    const totalSaves = (
      await db.query.savedRankings.findMany({
        where: (s, { eq }) => eq(s.collectionId, publicColBId),
      })
    ).length;

    const totalComments = (
      await db.query.comments.findMany({
        where: (c, { eq }) => eq(c.collectionId, publicColBId),
      })
    ).length;

    assert.equal(totalLikes, 1, "Likes count should be 1");
    assert.equal(totalSaves, 1, "Saves count should be 1");
    assert.equal(totalComments, 1, "Comments count should be 1");
  });

  it("6. Media Item Reviews Endpoint: retrieves all public reviews for a specific media item", async () => {
    const rawReviews = await db.query.ratings.findMany({
      where: (r, { and, eq, isNotNull, ne }) =>
        and(
          eq(r.mediaItemId, mediaItem1Id),
          isNotNull(r.reviewText),
          ne(r.reviewText, ""),
          isNotNull(r.collectionId)
        ),
      with: {
        collection: true,
        user: true,
      },
    });

    const publicReviews = rawReviews.filter(
      (r) => r.collection && r.collection.visibility === "public"
    );

    assert.equal(publicReviews.length, 1, "Should find 1 public review for San Junipero");
    assert.equal(publicReviews[0].user.id, userBId);
    assert.equal(publicReviews[0].collection?.id, publicColBId);
  });
});
