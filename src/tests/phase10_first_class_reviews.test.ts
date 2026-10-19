import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { db } from "../db";
import {
  user,
  collections,
  mediaItems,
  collectionEntries,
  ratings,
  reviews,
  comments,
  likes,
  userBlocks,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getPublicReviews } from "../lib/public-reviews";

describe("Phase 10: First-Class Independently Publishable Reviews", () => {
  const authorId = "test_author_phase10_" + Date.now();
  const readerId = "test_reader_phase10_" + Date.now();
  const blockedUserId = "test_blocked_phase10_" + Date.now();

  const authorEmail = `${authorId}@example.com`;
  const readerEmail = `${readerId}@example.com`;
  const blockedEmail = `${blockedUserId}@example.com`;

  const movieMediaId = "tmdb:movie:test_phase10_" + Date.now();

  before(async () => {
    // 1. Create test users
    await db.insert(user).values([
      {
        id: authorId,
        name: "Aubrey Critic",
        username: `aubrey_${Date.now().toString().slice(-6)}`,
        email: authorEmail,
      },
      {
        id: readerId,
        name: "Cinema Enthusiast",
        username: `reader_${Date.now().toString().slice(-6)}`,
        email: readerEmail,
      },
      {
        id: blockedUserId,
        name: "Blocked User",
        username: `blocked_${Date.now().toString().slice(-6)}`,
        email: blockedEmail,
      },
    ]);

    // 2. Insert test media item
    await db.insert(mediaItems).values({
      id: movieMediaId,
      mediaType: "movie",
      title: "Chungking Express",
      releaseDate: "1994-07-14",
      posterPath: "/test.jpg",
    });

    // 3. Establish a block relationship between author and blockedUser
    await db.insert(userBlocks).values({
      id: randomUUID(),
      blockerId: authorId,
      blockedId: blockedUserId,
    });
  });

  after(async () => {
    // Cleanup cascade
    await db.delete(comments).where(eq(comments.userId, readerId));
    await db.delete(likes).where(eq(likes.userId, readerId));
    await db.delete(reviews).where(eq(reviews.userId, authorId));
    await db.delete(userBlocks).where(eq(userBlocks.blockerId, authorId));
    await db.delete(mediaItems).where(eq(mediaItems.id, movieMediaId));
    await db.delete(user).where(eq(user.id, authorId));
    await db.delete(user).where(eq(user.id, readerId));
    await db.delete(user).where(eq(user.id, blockedUserId));
  });

  it("1. Allows writing and saving an independent review as draft without ranking or numerical rating", async () => {
    const draftReviewId = randomUUID();

    await db.insert(reviews).values({
      id: draftReviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Atmosphere and Fleeting Romance",
      content: "A sublime look at longing in Hong Kong. Still drafting thoughts on Faye Wong...",
      status: "draft",
      visibility: "private",
      isSpoiler: false,
      ratingId: null, // No rating reference required
    });

    const savedDraft = await db.query.reviews.findFirst({
      where: eq(reviews.id, draftReviewId),
    });

    assert.ok(savedDraft, "Draft review must be saved");
    assert.strictEqual(savedDraft.status, "draft");
    assert.strictEqual(savedDraft.visibility, "private");
    assert.strictEqual(savedDraft.publishedAt, null);
    assert.strictEqual(savedDraft.ratingId, null);
    assert.strictEqual(savedDraft.title, "Atmosphere and Fleeting Romance");
  });

  it("2. Explicitly publishes a draft review and stamps publication timestamp", async () => {
    const reviewId = randomUUID();

    // Start as draft
    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "First Impressions",
      content: "Work in progress draft.",
      status: "draft",
      visibility: "private",
    });

    const publishDate = new Date();
    // Publish
    await db
      .update(reviews)
      .set({
        status: "published",
        visibility: "public",
        publishedAt: publishDate,
        content: "Completed critical analysis of Chungking Express. Truly transcendent.",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    const published = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    assert.ok(published);
    assert.strictEqual(published.status, "published");
    assert.strictEqual(published.visibility, "public");
    assert.ok(published.publishedAt, "publishedAt must be recorded");
    assert.strictEqual(published.content, "Completed critical analysis of Chungking Express. Truly transcendent.");
  });

  it("3. Supports editing published reviews without losing identity or resetting creation time", async () => {
    const reviewId = randomUUID();
    const originalCreated = new Date(Date.now() - 3600000); // 1 hour ago

    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Initial Title",
      content: "Original text.",
      status: "published",
      visibility: "public",
      createdAt: originalCreated,
      publishedAt: originalCreated,
    });

    // Update review
    const editTimestamp = new Date();
    await db
      .update(reviews)
      .set({
        title: "Revised Masterpiece Review",
        content: "Expanded commentary on the Christopher Doyle cinematography.",
        isSpoiler: true,
        updatedAt: editTimestamp,
      })
      .where(eq(reviews.id, reviewId));

    const edited = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    assert.ok(edited);
    assert.strictEqual(edited.id, reviewId, "Review ID must remain stable");
    assert.strictEqual(edited.title, "Revised Masterpiece Review");
    assert.strictEqual(edited.content, "Expanded commentary on the Christopher Doyle cinematography.");
    assert.strictEqual(edited.isSpoiler, true);
    assert.strictEqual(edited.createdAt.toISOString(), originalCreated.toISOString(), "Original createdAt preserved");
  });

  it("4. Supports unpublishing without deleting content, and subsequent republishing", async () => {
    const reviewId = randomUUID();

    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Temporary Review",
      content: "Valuable insights that the author wants to take offline temporarily.",
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
    });

    // Unpublish
    await db
      .update(reviews)
      .set({
        status: "unpublished",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    const unpublished = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    assert.ok(unpublished);
    assert.strictEqual(unpublished.status, "unpublished");
    assert.strictEqual(unpublished.content, "Valuable insights that the author wants to take offline temporarily.");

    // Republish
    await db
      .update(reviews)
      .set({
        status: "published",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId));

    const republished = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    assert.ok(republished);
    assert.strictEqual(republished.status, "published");
  });

  it("5. Supports unlisted visibility: accessible directly but excluded from public discovery queries", async () => {
    const unlistedReviewId = randomUUID();
    const publicReviewId = randomUUID();

    await db.insert(reviews).values([
      {
        id: unlistedReviewId,
        userId: authorId,
        mediaItemId: movieMediaId,
        title: "Unlisted Hidden Gem Review",
        content: "Shared only with close friends via direct URL.",
        status: "published",
        visibility: "unlisted",
        publishedAt: new Date(),
      },
      {
        id: publicReviewId,
        userId: authorId,
        mediaItemId: movieMediaId,
        title: "Publicly Featured Review",
        content: "Visible to all visitors.",
        status: "published",
        visibility: "public",
        publishedAt: new Date(),
      },
    ]);

    // 1. Direct query by ID returns both
    const directUnlisted = await db.query.reviews.findFirst({
      where: eq(reviews.id, unlistedReviewId),
    });
    assert.ok(directUnlisted, "Direct link lookup must succeed");

    // 2. getPublicReviews helper (used for user profiles and public feeds) only returns public reviews
    const publicResults = await getPublicReviews(authorId);
    const publicIds = publicResults.map((r) => r.id);

    assert.ok(publicIds.includes(publicReviewId), "Public review must be listed");
    assert.ok(!publicIds.includes(unlistedReviewId), "Unlisted review must NOT be in public query results");
  });

  it("6. Supports multiple reviews of the same film over time (e.g., re-watches)", async () => {
    const rewatchMediaId = "tmdb:movie:rewatch_" + Date.now();
    await db.insert(mediaItems).values({
      id: rewatchMediaId,
      mediaType: "movie",
      title: "In the Mood for Love",
      releaseDate: "2000-09-29",
    });

    const firstReviewId = randomUUID();
    const secondReviewId = randomUUID();

    // Review #1: 2024 initial watch
    await db.insert(reviews).values({
      id: firstReviewId,
      userId: authorId,
      mediaItemId: rewatchMediaId,
      title: "First Viewing in 35mm",
      content: "Blew me away on first contact.",
      status: "published",
      visibility: "public",
      createdAt: new Date("2024-05-01T00:00:00Z"),
      publishedAt: new Date("2024-05-01T00:00:00Z"),
    });

    // Review #2: 2026 re-watch
    await db.insert(reviews).values({
      id: secondReviewId,
      userId: authorId,
      mediaItemId: rewatchMediaId,
      title: "Rewatch Two Years Later",
      content: "Hits even harder now. 10/10 masterpiece.",
      status: "published",
      visibility: "public",
      createdAt: new Date("2026-10-18T00:00:00Z"),
      publishedAt: new Date("2026-10-18T00:00:00Z"),
    });

    // Query all reviews by author for this media item
    const userReviewsForMedia = await db.query.reviews.findMany({
      where: and(eq(reviews.userId, authorId), eq(reviews.mediaItemId, rewatchMediaId)),
      orderBy: [desc(reviews.createdAt)],
    });

    assert.strictEqual(userReviewsForMedia.length, 2, "Both distinct reviews must coexist");
    assert.strictEqual(userReviewsForMedia[0].id, secondReviewId);
    assert.strictEqual(userReviewsForMedia[1].id, firstReviewId);

    // Clean up rewatch media item
    await db.delete(reviews).where(eq(reviews.mediaItemId, rewatchMediaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, rewatchMediaId));
  });

  it("7. Strictly preserves existing ratings, tier assignments, and personal notes", async () => {
    // Create an existing collection with a rating and personal note
    const colId = "col_preserve_" + Date.now();
    const entryId = "entry_preserve_" + Date.now();
    const ratingId = "rat_preserve_" + Date.now();

    await db.insert(collections).values({
      id: colId,
      userId: authorId,
      title: "Favorites Ranking",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    await db.insert(collectionEntries).values({
      id: entryId,
      collectionId: colId,
      mediaItemId: movieMediaId,
      sortOrder: 1,
    });

    await db.insert(ratings).values({
      id: ratingId,
      collectionId: colId,
      mediaItemId: movieMediaId,
      userId: authorId,
      calculatedOverallScore: 97,
      reviewText: "Legacy ranking commentary in collection",
      personalNotes: "Extremely private diary note: watched with friends in cinema",
      tierId: null,
    });

    // Now write a separate first-class review
    const standaloneReviewId = randomUUID();
    await db.insert(reviews).values({
      id: standaloneReviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Standalone Essay",
      content: "Published independently from ranking.",
      status: "published",
      visibility: "public",
    });

    // Inspect that collection rating and private personal notes are completely intact
    const originalRating = await db.query.ratings.findFirst({
      where: eq(ratings.id, ratingId),
    });

    assert.ok(originalRating);
    assert.strictEqual(originalRating.calculatedOverallScore, 97);
    assert.strictEqual(originalRating.reviewText, "Legacy ranking commentary in collection");
    assert.strictEqual(
      originalRating.personalNotes,
      "Extremely private diary note: watched with friends in cinema"
    );

    // Clean up collection
    await db.delete(ratings).where(eq(ratings.id, ratingId));
    await db.delete(collectionEntries).where(eq(collectionEntries.id, entryId));
    await db.delete(collections).where(eq(collections.id, colId));
  });

  it("8. Supports social interactions (likes, 1-level threaded comments) and cascades upon deletion", async () => {
    const reviewId = randomUUID();

    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Review for Social Testing",
      content: "Let us discuss this film.",
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
    });

    // Reader likes the review
    const likeId = randomUUID();
    await db.insert(likes).values({
      id: likeId,
      userId: readerId,
      collectionId: null,
      reviewId,
    });

    // Reader posts a top-level comment
    const topCommentId = randomUUID();
    await db.insert(comments).values({
      id: topCommentId,
      userId: readerId,
      collectionId: null,
      reviewId,
      parentId: null,
      content: "Fabulous critique! Couldn't agree more.",
      isSpoiler: false,
    });

    // Author posts a 1-level reply
    const replyCommentId = randomUUID();
    await db.insert(comments).values({
      id: replyCommentId,
      userId: authorId,
      collectionId: null,
      reviewId,
      parentId: topCommentId,
      content: "Thank you for reading!",
      isSpoiler: false,
    });

    // Verify relationships
    const reviewLikes = await db.query.likes.findMany({
      where: eq(likes.reviewId, reviewId),
    });
    assert.strictEqual(reviewLikes.length, 1);
    assert.strictEqual(reviewLikes[0].userId, readerId);

    const reviewComments = await db.query.comments.findMany({
      where: eq(comments.reviewId, reviewId),
    });
    assert.strictEqual(reviewComments.length, 2);

    // Delete the review permanently
    await db.delete(reviews).where(eq(reviews.id, reviewId));

    // Verify cascade
    const remainingLikes = await db.query.likes.findMany({
      where: eq(likes.reviewId, reviewId),
    });
    assert.strictEqual(remainingLikes.length, 0, "Likes must cascade upon review deletion");

    const remainingComments = await db.query.comments.findMany({
      where: eq(comments.reviewId, reviewId),
    });
    assert.strictEqual(remainingComments.length, 0, "Comments must cascade upon review deletion");
  });
});
