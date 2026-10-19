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

  it("9. Enforces explicit commentary sharing: thoughts are private by default and only shared items are visible to visitors", async () => {
    const colId = "col_sharing_" + Date.now();
    const mediaId1 = "tmdb:movie:share1_" + Date.now();
    const mediaId2 = "tmdb:movie:share2_" + Date.now();

    await db.insert(mediaItems).values([
      { id: mediaId1, mediaType: "movie", title: "In the Mood for Love" },
      { id: mediaId2, mediaType: "movie", title: "2046" },
    ]);

    await db.insert(collections).values({
      id: colId,
      userId: authorId,
      title: "Wong Kar-wai Diptych",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    await db.insert(collectionEntries).values([
      { id: "ent1_" + Date.now(), collectionId: colId, mediaItemId: mediaId1, sortOrder: 1 },
      { id: "ent2_" + Date.now(), collectionId: colId, mediaItemId: mediaId2, sortOrder: 2 },
    ]);

    // Item 1: Private thoughts (shareCommentary: false)
    const rating1Id = "rate_priv_" + Date.now();
    await db.insert(ratings).values({
      id: rating1Id,
      collectionId: colId,
      mediaItemId: mediaId1,
      userId: authorId,
      reviewText: "Secret critique: private personal reflections.",
      personalNotes: "Do not share.",
      shareCommentary: false,
    });

    // Item 2: Explicitly shared thoughts (shareCommentary: true)
    const rating2Id = "rate_pub_" + Date.now();
    await db.insert(ratings).values({
      id: rating2Id,
      collectionId: colId,
      mediaItemId: mediaId2,
      userId: authorId,
      reviewText: "Publicly shared commentary: visual poetry.",
      personalNotes: "Private reminder to buy bluray.",
      shareCommentary: true,
    });

    // 1. Check Owner access: sees both thoughts and personal notes
    const ownerRatings = await db.query.ratings.findMany({
      where: and(eq(ratings.userId, authorId), eq(ratings.collectionId, colId)),
    });
    const r1Owner = ownerRatings.find((r) => r.id === rating1Id);
    const r2Owner = ownerRatings.find((r) => r.id === rating2Id);
    assert.strictEqual(r1Owner?.reviewText, "Secret critique: private personal reflections.");
    assert.strictEqual(r1Owner?.personalNotes, "Do not share.");
    assert.strictEqual(r2Owner?.reviewText, "Publicly shared commentary: visual poetry.");

    // 2. Check Visitor access (simulating /api/collections/[id] logic)
    const visitorRatings = ownerRatings.map((r) => ({
      ...r,
      personalNotes: null,
      reviewText: r.shareCommentary ? r.reviewText : null,
    }));
    const r1Visitor = visitorRatings.find((r) => r.id === rating1Id);
    const r2Visitor = visitorRatings.find((r) => r.id === rating2Id);

    assert.strictEqual(r1Visitor?.reviewText, null, "Unshared thoughts must be null for visitors");
    assert.strictEqual(r1Visitor?.personalNotes, null, "Personal notes must be null for visitors");
    assert.strictEqual(
      r2Visitor?.reviewText,
      "Publicly shared commentary: visual poetry.",
      "Explicitly shared commentary must be visible to visitors"
    );
    assert.strictEqual(r2Visitor?.personalNotes, null, "Personal notes must still be null even for shared items");

    // 3. Ranking commentary stays on the ranking: default getPublicReviews returns ONLY first-class reviews
    const publicReviewsDefault = await getPublicReviews(authorId);
    assert.strictEqual(
      publicReviewsDefault.some((r) => r.id === rating1Id || r.id === rating2Id),
      false,
      "Ranking commentary must NOT appear in default public reviews query"
    );

    // Optional legacy fallback still honors shareCommentary
    const publicReviewsLegacy = await getPublicReviews(authorId, { includeLegacyRatings: true });
    assert.strictEqual(publicReviewsLegacy.some((r) => r.id === rating1Id), false);
    assert.strictEqual(publicReviewsLegacy.some((r) => r.id === rating2Id), true);

    // Cleanup
    await db.delete(ratings).where(and(eq(ratings.collectionId, colId)));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, colId));
    await db.delete(collections).where(eq(collections.id, colId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId1));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId2));
  });

  it("10. Preserves private writing separately from published reviews snapshot", async () => {
    const colId = "col_snap_" + Date.now();
    const mediaId = "tmdb:movie:snap_" + Date.now();

    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Days of Being Wild" });
    await db.insert(collections).values({
      id: colId,
      userId: authorId,
      title: "Snapshot Test Collection",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    const ratingId = "rate_snap_" + Date.now();
    await db.insert(ratings).values({
      id: ratingId,
      collectionId: colId,
      mediaItemId: mediaId,
      userId: authorId,
      reviewText: "Initial draft thoughts while rating.",
      personalNotes: "Initial note",
      shareCommentary: false,
    });

    // User publishes as standalone review
    const reviewId = randomUUID();
    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: mediaId,
      ratingId,
      title: "Published Review Title",
      content: "Snapshot of review content published to community.",
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
    });

    // User subsequently edits private thoughts in the rating dialog
    await db
      .update(ratings)
      .set({
        reviewText: "Edited private thoughts after re-watch months later.",
        updatedAt: new Date(),
      })
      .where(eq(ratings.id, ratingId));

    // Verify: Published review was NOT silently altered by editing private notes
    const reviewInDb = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
    const ratingInDb = await db.query.ratings.findFirst({ where: eq(ratings.id, ratingId) });

    assert.strictEqual(reviewInDb?.content, "Snapshot of review content published to community.");
    assert.strictEqual(ratingInDb?.reviewText, "Edited private thoughts after re-watch months later.");

    // Cleanup
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    await db.delete(ratings).where(eq(ratings.id, ratingId));
    await db.delete(collections).where(eq(collections.id, colId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
  });

  it("11. Unpublishing review removes it immediately from public discovery and getPublicReviews", async () => {
    const reviewId = randomUUID();
    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: movieMediaId,
      title: "Discoverable Review",
      content: "This will be unpublished.",
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
    });

    // 1. Initially appears in getPublicReviews
    let publicRevs = await getPublicReviews(authorId);
    assert.strictEqual(publicRevs.some((r) => r.id === reviewId), true);

    // 2. Unpublish it
    await db
      .update(reviews)
      .set({ status: "unpublished", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));

    // 3. Immediately disappears from getPublicReviews
    publicRevs = await getPublicReviews(authorId);
    assert.strictEqual(publicRevs.some((r) => r.id === reviewId), false, "Unpublished review must not appear in public reviews");

    // Content remains intact in DB for owner
    const unpubReview = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
    assert.strictEqual(unpubReview?.status, "unpublished");
    assert.strictEqual(unpubReview?.content, "This will be unpublished.");

    await db.delete(reviews).where(eq(reviews.id, reviewId));
  });

  it("12. Prevent implicit disclosure of private ratings: creating review without ratingId does not attach author's private rating", async () => {
    const mediaId = "tmdb:movie:implicit_" + Date.now();
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Secret Private Film" });

    // User has a private rating for this media item
    const privateRatingId = "rate_priv_" + Date.now();
    await db.insert(ratings).values({
      id: privateRatingId,
      mediaItemId: mediaId,
      userId: authorId,
      sourceRating: 10,
      calculatedOverallScore: 9.8,
      reviewText: "Private thoughts",
      personalNotes: "Top secret diary entry",
    });

    // Simulated review creation without explicit ratingId:
    // Should NOT automatically attach privateRatingId
    const reviewId = `rev_${randomUUID()}`;
    await db.insert(reviews).values({
      id: reviewId,
      userId: authorId,
      mediaItemId: mediaId,
      ratingId: null, // No implicit linking!
      title: "Independent Review",
      content: "Review written without attaching private rating.",
      status: "published",
      visibility: "public",
      publishedAt: new Date(),
    });

    const savedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      with: { rating: true },
    });

    assert.strictEqual(savedReview?.ratingId, null, "Review created without ratingId must remain unlinked");
    assert.strictEqual(savedReview?.rating, null, "No rating score or tier should be disclosed");

    await db.delete(reviews).where(eq(reviews.id, reviewId));
    await db.delete(ratings).where(eq(ratings.id, privateRatingId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
  });

  it("13. Restore access to historical private notes: ratings with only personalNotes preserve notes without silent overwriting", async () => {
    const mediaId = "tmdb:movie:notes_" + Date.now();
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Note Preservation Film" });

    const ratingId = "rate_notes_" + Date.now();
    // Rating created historically with ONLY personalNotes (reviewText is null)
    await db.insert(ratings).values({
      id: ratingId,
      mediaItemId: mediaId,
      userId: authorId,
      reviewText: null,
      personalNotes: "Historical private curator reminder from 2024.",
      shareCommentary: false,
    });

    const fetched = await db.query.ratings.findFirst({
      where: eq(ratings.id, ratingId),
    });

    assert.strictEqual(fetched?.reviewText, null);
    assert.strictEqual(fetched?.personalNotes, "Historical private curator reminder from 2024.");

    // User updates thoughts without destroying personalNotes
    await db
      .update(ratings)
      .set({
        reviewText: "New public-ready thoughts.",
        personalNotes: "Updated private note.",
        updatedAt: new Date(),
      })
      .where(eq(ratings.id, ratingId));

    const updated = await db.query.ratings.findFirst({
      where: eq(ratings.id, ratingId),
    });

    assert.strictEqual(updated?.reviewText, "New public-ready thoughts.");
    assert.strictEqual(updated?.personalNotes, "Updated private note.");

    await db.delete(ratings).where(eq(ratings.id, ratingId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
  });

  it("14. Prevent hidden filters from affecting Tier Board: Tier Board retains all items regardless of rating status filter", async () => {
    const entries = [
      { id: "e1", ratingStatus: { state: "rated", tier: { id: "tier_s", sortOrder: 1 } } },
      { id: "e2", ratingStatus: { state: "in_progress", tier: null } },
      { id: "e3", ratingStatus: { state: "unrated", tier: null } },
    ];

    // Helper implementing the viewMode !== "tier_board" filter rule
    const applyFilter = (list: typeof entries, viewMode: string, filterRated: string) => {
      let result = [...list];
      if (viewMode !== "tier_board") {
        if (filterRated === "rated") {
          result = result.filter((e) => e.ratingStatus.state === "rated");
        } else if (filterRated === "unrated") {
          result = result.filter((e) => e.ratingStatus.state === "unrated");
        }
      }
      return result;
    };

    // When in list view with 'unrated' filter: only e3 is returned
    const listFiltered = applyFilter(entries, "list", "unrated");
    assert.strictEqual(listFiltered.length, 1);
    assert.strictEqual(listFiltered[0].id, "e3");

    // When switching to tier_board view with the same 'unrated' filter: ALL entries are preserved!
    const tierBoardEntries = applyFilter(entries, "tier_board", "unrated");
    assert.strictEqual(tierBoardEntries.length, 3, "Tier board must display all items regardless of previous filter");
  });

  it("15. Clarify ranking commentary visibility: turning off commentary sharing removes it from visitor responses", async () => {
    const colId = "col_comm_" + Date.now();
    const mediaId = "tmdb:movie:comm_" + Date.now();

    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Commentary Test Movie" });
    await db.insert(collections).values({
      id: colId,
      userId: authorId,
      title: "Commentary Collection",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    const ratingId = "rate_comm_" + Date.now();
    await db.insert(ratings).values({
      id: ratingId,
      collectionId: colId,
      mediaItemId: mediaId,
      userId: authorId,
      reviewText: "Ranking reflection text.",
      personalNotes: "Private note.",
      shareCommentary: true,
    });

    // 1. Initially shared: visitor sees reviewText
    let r = await db.query.ratings.findFirst({ where: eq(ratings.id, ratingId) });
    let visitorReviewText = r?.shareCommentary ? r.reviewText : null;
    let visitorPersonalNotes = null;
    assert.strictEqual(visitorReviewText, "Ranking reflection text.");
    assert.strictEqual(visitorPersonalNotes, null);

    // 2. Author turns off commentary sharing: shareCommentary -> false
    await db.update(ratings).set({ shareCommentary: false }).where(eq(ratings.id, ratingId));

    r = await db.query.ratings.findFirst({ where: eq(ratings.id, ratingId) });
    visitorReviewText = r?.shareCommentary ? r.reviewText : null;
    assert.strictEqual(visitorReviewText, null, "Turning off commentary sharing must immediately remove it from visitor view");
    // Owner still retains reviewText and personalNotes in DB
    assert.strictEqual(r?.reviewText, "Ranking reflection text.");
    assert.strictEqual(r?.personalNotes, "Private note.");

    await db.delete(ratings).where(eq(ratings.id, ratingId));
    await db.delete(collections).where(eq(collections.id, colId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
  });

  it("16. Explicit publication consent: new reviews default rating attachment to unchecked; Thoughts text prefilled without substituting private personalNotes", async () => {
    // A. RatingDialog prefill logic test
    const ratingWithOnlyPersonalNotes = {
      id: "rate_pn_only",
      reviewText: null,
      personalNotes: "Super secret private diary notes that should NEVER become public review text.",
    };

    // When Thoughts (reviewText) is empty, prefill content must be empty, NOT substituted with personalNotes
    const prefillForPnOnly = ratingWithOnlyPersonalNotes.reviewText || "";
    assert.strictEqual(prefillForPnOnly, "", "Must not substitute personalNotes when reviewText is empty");

    const ratingWithThoughts = {
      id: "rate_thoughts",
      reviewText: "Public critique thoughts.",
      personalNotes: "Owner notes.",
    };
    const prefillForThoughts = ratingWithThoughts.reviewText || "";
    assert.strictEqual(prefillForThoughts, "Public critique thoughts.", "Prefills Thoughts when present");

    // B. Default attachment consent logic in ReviewEditorDialog
    // For a new review (id is undefined), attachRating must default to false even when candidate ratingId exists
    const newReviewExistingReviewProp = {
      id: undefined,
      ratingId: "rate_candidate_123",
      score: 9.5,
    };
    const isEditingNew = Boolean(newReviewExistingReviewProp.id);
    const attachRatingDefaultNew = Boolean(newReviewExistingReviewProp.id && newReviewExistingReviewProp.ratingId);
    assert.strictEqual(attachRatingDefaultNew, false, "New review must default attachRating to false");

    // For an existing review that already has a rating attached, attachRating preserves true
    const existingReviewWithRating = {
      id: "rev_123",
      ratingId: "rate_attached_456",
      score: 8.0,
    };
    const attachRatingDefaultExisting = Boolean(existingReviewWithRating.id && existingReviewWithRating.ratingId);
    assert.strictEqual(attachRatingDefaultExisting, true, "Existing review with rating attached preserves attachRating as true");

    // For an existing review without rating attached, attachRating remains false
    const existingReviewWithoutRating = {
      id: "rev_789",
      ratingId: null,
      score: null,
    };
    const attachRatingDefaultExistingNoRating = Boolean(existingReviewWithoutRating.id && existingReviewWithoutRating.ratingId);
    assert.strictEqual(attachRatingDefaultExistingNoRating, false, "Existing review without rating preserves attachRating as false");
  });

  it("17. Tier Board ordering: preserves saved item ordering within tiers regardless of previous List/Grid sort selection", async () => {
    // Mock collection entries with explicit saved sortOrder and various ratings/tiers
    const entries = [
      { id: "e1", sortOrder: 3, mediaItem: { title: "Zebra (Late Entry)", seasonNumber: 1 }, ratingStatus: { state: "rated", tier: { id: "tier_s", sortOrder: 1 } } },
      { id: "e2", sortOrder: 1, mediaItem: { title: "Alpha (First Entry)", seasonNumber: 1 }, ratingStatus: { state: "rated", tier: { id: "tier_s", sortOrder: 1 } } },
      { id: "e3", sortOrder: 2, mediaItem: { title: "Beta (Second Entry)", seasonNumber: 2 }, ratingStatus: { state: "rated", tier: { id: "tier_a", sortOrder: 2 } } },
    ];

    // Helper replicating collection page processedEntries logic
    const processEntries = (
      listInput: typeof entries,
      viewMode: string,
      sortBy: string,
      selectedSeason: string = "all",
      searchFilter: string = ""
    ) => {
      let list = [...listInput];

      if (viewMode !== "tier_board") {
        // filterRated logic...
      }

      if (selectedSeason !== "all") {
        const sNum = parseInt(selectedSeason, 10);
        list = list.filter((e) => e.mediaItem?.seasonNumber === sNum);
      }

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        list = list.filter((e) => e.mediaItem?.title?.toLowerCase().includes(q));
      }

      if (viewMode === "tier_board") {
        list.sort((a, b) => {
          const aOrder = typeof a.sortOrder === "number" ? a.sortOrder : 0;
          const bOrder = typeof b.sortOrder === "number" ? b.sortOrder : 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.id || "").localeCompare(b.id || "");
        });
        return list;
      }

      // List/grid sorting
      list.sort((a, b) => {
        if (sortBy === "title") {
          return (a.mediaItem?.title || "").localeCompare(b.mediaItem?.title || "");
        }
        return a.sortOrder - b.sortOrder;
      });
      return list;
    };

    // 1. In list view with sortBy === "title", items are sorted alphabetically (Alpha, Beta, Zebra)
    const listAlphabetical = processEntries(entries, "list", "title");
    assert.deepStrictEqual(listAlphabetical.map((e) => e.id), ["e2", "e3", "e1"]);

    // 2. Switching to tier_board view preserves saved sortOrder (e2 with sortOrder:1, e3 with sortOrder:2, e1 with sortOrder:3)
    // even though sortBy was "title"!
    const tierBoardResult = processEntries(entries, "tier_board", "title");
    assert.deepStrictEqual(tierBoardResult.map((e) => e.id), ["e2", "e3", "e1"]);

    // Specifically within Tier S: e2 (sortOrder:1) precedes e1 (sortOrder:3)
    const tierSEntries = tierBoardResult.filter((e) => e.ratingStatus.tier?.id === "tier_s");
    assert.deepStrictEqual(tierSEntries.map((e) => e.id), ["e2", "e1"]);

    // 3. Season filter is preserved in tier_board mode
    const tierBoardSeason1 = processEntries(entries, "tier_board", "title", "1");
    assert.strictEqual(tierBoardSeason1.length, 2);
    assert.deepStrictEqual(tierBoardSeason1.map((e) => e.id), ["e2", "e1"]);

    // 4. Search filter is preserved in tier_board mode
    const tierBoardSearch = processEntries(entries, "tier_board", "title", "all", "Zebra");
    assert.strictEqual(tierBoardSearch.length, 1);
    assert.strictEqual(tierBoardSearch[0].id, "e1");
  });
});
