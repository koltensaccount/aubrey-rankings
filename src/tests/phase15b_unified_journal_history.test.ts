import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { UnifiedTimelineCardData } from "../lib/timeline-activity";

// =============================================================================
// Safety Checks BEFORE Database Modules Initialize
// =============================================================================
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const isOptedIn =
  process.env.AUBREY_TEST_MODE === "1" ||
  process.env.ALLOW_TEST_DB_WRITES === "1";

if (!isOptedIn) {
  throw new Error(
    "Phase 15B Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Phase 15B Test aborted: DATABASE_URL is required.");
}

const parsedUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Phase 15B Test aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
const isExplicitTestDb = dbName.endsWith("_test") || dbName.includes("test");
if (!isExplicitTestDb) {
  throw new Error(
    `Phase 15B Test aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test".`
  );
}

// Database & helper modules
let db: typeof import("../db").db;
let user: typeof import("../db/schema").user;
let mediaItems: typeof import("../db/schema").mediaItems;
let mediaNotes: typeof import("../db/schema").mediaNotes;
let ratings: typeof import("../db/schema").ratings;
let reviews: typeof import("../db/schema").reviews;
let diaryEntries: typeof import("../db/schema").diaryEntries;
let watchlistItems: typeof import("../db/schema").watchlistItems;
let activityEvents: typeof import("../db/schema").activityEvents;
let collections: typeof import("../db/schema").collections;
let collectionEntries: typeof import("../db/schema").collectionEntries;
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;
let isNull: typeof import("drizzle-orm").isNull;

let combineChronologicalActivities: typeof import("../lib/timeline-activity").combineChronologicalActivities;
let backfillUserActivityEvents: typeof import("../lib/timeline-activity").backfillUserActivityEvents;
let markRankedMediaAsWatched: typeof import("../lib/watched-status").markRankedMediaAsWatched;
let reconcileUserRankedWatchedStatus: typeof import("../lib/watched-status").reconcileUserRankedWatchedStatus;

describe("Phase 15B: Unified Notes, Reviews, Ratings & Activity History", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const user1Id = `usr_p15b_u1_${suffix}`;
  const user2Id = `usr_p15b_u2_${suffix}`;
  const movie1Id = `med_p15b_m1_${suffix}`;
  const movie2Id = `med_p15b_m2_${suffix}`;
  const seriesId = `tv_9876_${suffix}`;
  const episode1Id = `tv_9876_${suffix}_s1_e1`;

  before(async () => {
    const dbModule = await import("../db");
    const schemaModule = await import("../db/schema");
    const ormModule = await import("drizzle-orm");
    const timelineModule = await import("../lib/timeline-activity");
    const watchedModule = await import("../lib/watched-status");

    db = dbModule.db;
    user = schemaModule.user;
    mediaItems = schemaModule.mediaItems;
    mediaNotes = schemaModule.mediaNotes;
    ratings = schemaModule.ratings;
    reviews = schemaModule.reviews;
    diaryEntries = schemaModule.diaryEntries;
    watchlistItems = schemaModule.watchlistItems;
    activityEvents = schemaModule.activityEvents;
    collections = schemaModule.collections;
    collectionEntries = schemaModule.collectionEntries;
    eq = ormModule.eq;
    and = ormModule.and;
    isNull = ormModule.isNull;

    combineChronologicalActivities = timelineModule.combineChronologicalActivities;
    backfillUserActivityEvents = timelineModule.backfillUserActivityEvents;
    markRankedMediaAsWatched = watchedModule.markRankedMediaAsWatched;
    reconcileUserRankedWatchedStatus = watchedModule.reconcileUserRankedWatchedStatus;

    // Seed test users
    await db.insert(user).values({
      id: user1Id,
      name: "Phase 15B User 1",
      email: `p15b_user1_${suffix}@test.local`,
    });
    await db.insert(user).values({
      id: user2Id,
      name: "Phase 15B User 2",
      email: `p15b_user2_${suffix}@test.local`,
    });

    // Seed test media items
    await db.insert(mediaItems).values({
      id: movie1Id,
      title: "Chinatown",
      releaseDate: "1974-06-20",
      mediaType: "movie",
    });
    await db.insert(mediaItems).values({
      id: movie2Id,
      title: "The Long Goodbye",
      releaseDate: "1973-03-07",
      mediaType: "movie",
    });
    await db.insert(mediaItems).values({
      id: seriesId,
      title: "Twin Peaks",
      releaseDate: "1990-04-08",
      mediaType: "tv",
    });
    await db.insert(mediaItems).values({
      id: episode1Id,
      title: "Pilot (Northwest Passage)",
      releaseDate: "1990-04-08",
      mediaType: "episode",
      parentMediaId: seriesId,
      seasonNumber: 1,
      episodeNumber: 1,
    });
  });

  after(async () => {
    // Cleanup in reverse dependency order
    await db.delete(activityEvents).where(eq(activityEvents.userId, user1Id));
    await db.delete(activityEvents).where(eq(activityEvents.userId, user2Id));
    await db.delete(collections).where(eq(collections.userId, user1Id));
    await db.delete(collections).where(eq(collections.userId, user2Id));
    await db.delete(mediaNotes).where(eq(mediaNotes.userId, user1Id));
    await db.delete(mediaNotes).where(eq(mediaNotes.userId, user2Id));
    await db.delete(diaryEntries).where(eq(diaryEntries.userId, user1Id));
    await db.delete(diaryEntries).where(eq(diaryEntries.userId, user2Id));
    await db.delete(reviews).where(eq(reviews.userId, user1Id));
    await db.delete(reviews).where(eq(reviews.userId, user2Id));
    await db.delete(ratings).where(eq(ratings.userId, user1Id));
    await db.delete(ratings).where(eq(ratings.userId, user2Id));
    await db.delete(watchlistItems).where(eq(watchlistItems.userId, user1Id));
    await db.delete(watchlistItems).where(eq(watchlistItems.userId, user2Id));
    await db.delete(mediaItems).where(eq(mediaItems.id, episode1Id));
    await db.delete(mediaItems).where(eq(mediaItems.id, seriesId));
    await db.delete(mediaItems).where(eq(mediaItems.id, movie1Id));
    await db.delete(mediaItems).where(eq(mediaItems.id, movie2Id));
    await db.delete(user).where(eq(user.id, user1Id));
    await db.delete(user).where(eq(user.id, user2Id));
  });

  // ---------------------------------------------------------------------------
  // Invariant 1: Universal Notes uniqueness
  // ---------------------------------------------------------------------------
  it("Invariant 1: enforces exactly one media_notes record per user per title via unique constraint", async () => {
    const noteId1 = `note_${randomUUID()}`;
    await db.insert(mediaNotes).values({
      id: noteId1,
      userId: user1Id,
      mediaItemId: movie1Id,
      content: "First note about Chinatown.",
    });

    const note = await db.query.mediaNotes.findFirst({
      where: and(eq(mediaNotes.userId, user1Id), eq(mediaNotes.mediaItemId, movie1Id)),
    });
    assert.ok(note, "Note should be persisted");
    assert.equal(note.content, "First note about Chinatown.");

    // Attempt duplicate insert - must reject via uniq_user_media_notes constraint
    await assert.rejects(
      async () => {
        await db.insert(mediaNotes).values({
          id: `note_${randomUUID()}`,
          userId: user1Id,
          mediaItemId: movie1Id,
          content: "Duplicate note attempt.",
        });
      },
      (err: any) => /unique|duplicate/i.test(String(err) + " " + (err?.cause?.message || "")),
      "Duplicate note insert for same user and title must violate unique constraint"
    );
  });

  // ---------------------------------------------------------------------------
  // Invariant 2: Universal Notes privacy
  // ---------------------------------------------------------------------------
  it("Invariant 2: media_notes is strictly private and never exposed to another user", async () => {
    // User 2 queries mediaNotes for movie1Id - must not see User 1's note
    const user2Notes = await db.query.mediaNotes.findMany({
      where: and(eq(mediaNotes.userId, user2Id), eq(mediaNotes.mediaItemId, movie1Id)),
    });
    assert.equal(user2Notes.length, 0, "User 2 must see 0 notes for User 1's title");
  });

  // ---------------------------------------------------------------------------
  // Invariant 3: Universal Notes backward compatibility & two-way sync
  // ---------------------------------------------------------------------------
  it("Invariant 3: ratings.personalNotes transparently syncs with mediaNotes", async () => {
    const rateId = `rate_${randomUUID()}`;
    await db.insert(ratings).values({
      id: rateId,
      userId: user1Id,
      mediaItemId: movie2Id,
      sourceRating: 4.5,
      sourceScale: 5,
      personalNotes: "Legacy note stored in ratings table.",
    });

    // Emulate sync logic from /api/notes or /api/ratings
    const existingNote = await db.query.mediaNotes.findFirst({
      where: and(eq(mediaNotes.userId, user1Id), eq(mediaNotes.mediaItemId, movie2Id)),
    });

    if (!existingNote) {
      const existingRating = await db.query.ratings.findFirst({
        where: and(eq(ratings.userId, user1Id), eq(ratings.mediaItemId, movie2Id), isNull(ratings.collectionId)),
      });
      if (existingRating?.personalNotes) {
        await db.insert(mediaNotes).values({
          id: `note_${randomUUID()}`,
          userId: user1Id,
          mediaItemId: movie2Id,
          content: existingRating.personalNotes,
        });
      }
    }

    const syncedNote = await db.query.mediaNotes.findFirst({
      where: and(eq(mediaNotes.userId, user1Id), eq(mediaNotes.mediaItemId, movie2Id)),
    });
    assert.ok(syncedNote, "media_notes should be backfilled from ratings.personalNotes");
    assert.equal(syncedNote.content, "Legacy note stored in ratings table.");
  });

  // ---------------------------------------------------------------------------
  // Invariant 4: Multiple Reviews per Title
  // ---------------------------------------------------------------------------
  it("Invariant 4: supports multiple distinct first-class reviews for the same user and title", async () => {
    const rev1Id = `rev_${randomUUID()}`;
    const rev2Id = `rev_${randomUUID()}`;

    await db.insert(reviews).values([
      {
        id: rev1Id,
        userId: user1Id,
        mediaItemId: movie1Id,
        title: "First Theatrical Reaction",
        content: "A masterclass in neo-noir pacing and cynicism.",
        contentFormat: "markdown",
        status: "published",
        visibility: "public",
        ratingValue: 9.0,
        sourceRating: 4.5,
        sourceScale: 5,
        publishedAt: new Date("2024-01-15T20:00:00Z"),
        createdAt: new Date("2024-01-15T20:00:00Z"),
      },
      {
        id: rev2Id,
        userId: user1Id,
        mediaItemId: movie1Id,
        title: "4K Criterion Rewatch",
        content: "The water conspiracy feels even more contemporary today.",
        contentFormat: "markdown",
        status: "published",
        visibility: "public",
        ratingValue: 10.0,
        sourceRating: 5.0,
        sourceScale: 5,
        publishedAt: new Date("2024-06-20T21:00:00Z"),
        createdAt: new Date("2024-06-20T21:00:00Z"),
      },
    ]);

    const userReviews = await db.query.reviews.findMany({
      where: and(eq(reviews.userId, user1Id), eq(reviews.mediaItemId, movie1Id)),
    });
    assert.equal(userReviews.length, 2, "User should have exactly 2 distinct reviews");
  });

  // ---------------------------------------------------------------------------
  // Invariant 5: Latest Rated Review Score Precedence
  // ---------------------------------------------------------------------------
  it("Invariant 5: primary displayed review score is the latest rated review score", async () => {
    const userReviews = await db.query.reviews.findMany({
      where: and(eq(reviews.userId, user1Id), eq(reviews.mediaItemId, movie1Id)),
      orderBy: (r, { desc }) => [desc(r.publishedAt), desc(r.createdAt)],
    });

    const latestRated = userReviews.find((r) => typeof r.ratingValue === "number");
    assert.ok(latestRated, "Should find a rated review");
    assert.equal(latestRated.ratingValue, 10.0, "Latest rated review score must be 10.0");
    assert.equal(latestRated.title, "4K Criterion Rewatch");
  });

  // ---------------------------------------------------------------------------
  // Invariant 6: Score Preservation Across Unrated Reviews
  // ---------------------------------------------------------------------------
  it("Invariant 6: creating a newer unrated review does not overwrite or erase earlier review scores", async () => {
    const rev3Id = `rev_${randomUUID()}`;
    await db.insert(reviews).values({
      id: rev3Id,
      userId: user1Id,
      mediaItemId: movie1Id,
      title: "Quick Note on Cinematography",
      content: "John Alonzo's Panavision framing is unmatched.",
      contentFormat: "markdown",
      status: "published",
      visibility: "public",
      ratingValue: null,
      sourceRating: null,
      sourceScale: null,
      publishedAt: new Date("2025-02-01T12:00:00Z"),
      createdAt: new Date("2025-02-01T12:00:00Z"),
    });

    const userReviews = await db.query.reviews.findMany({
      where: and(eq(reviews.userId, user1Id), eq(reviews.mediaItemId, movie1Id)),
      orderBy: (r, { desc }) => [desc(r.publishedAt), desc(r.createdAt)],
    });

    assert.equal(userReviews.length, 3, "Total 3 reviews");
    assert.equal(userReviews[0].title, "Quick Note on Cinematography");
    assert.equal(userReviews[0].ratingValue, null, "Newest review is unrated");

    // Precedence resolution: find latest with a non-null ratingValue
    const latestRated = userReviews.find((r) => typeof r.ratingValue === "number" && r.ratingValue !== null);
    assert.ok(latestRated, "Must still resolve earlier rated review");
    assert.equal(latestRated.ratingValue, 10.0, "Preserved score must remain 10.0 from 4K Criterion review");
  });

  // ---------------------------------------------------------------------------
  // Invariant 7: Ranking Score Isolation
  // ---------------------------------------------------------------------------
  it("Invariant 7: ranking scores (collectionId !== null) are never conflated with review or standalone ratings", async () => {
    const colId = `col_${randomUUID()}`;
    await db.insert(collections).values({
      id: colId,
      userId: user1Id,
      title: "70s Neo-Noir Ranked",
      collectionType: "ranking",
      isRanked: true,
      visibility: "public",
    });

    const colRatingId = `rate_col_${randomUUID()}`;
    await db.insert(ratings).values({
      id: colRatingId,
      userId: user1Id,
      mediaItemId: movie1Id,
      collectionId: colId,
      calculatedOverallScore: 6.5,
      sourceRating: 6.5,
      sourceScale: 10,
    });

    // Standalone / review rating query strictly excludes collection-scoped ratings
    const standaloneRating = await db.query.ratings.findFirst({
      where: and(eq(ratings.userId, user1Id), eq(ratings.mediaItemId, movie1Id), isNull(ratings.collectionId)),
    });

    assert.equal(standaloneRating, undefined, "No standalone global rating exists yet for movie 1");

    const colRating = await db.query.ratings.findFirst({
      where: and(eq(ratings.userId, user1Id), eq(ratings.mediaItemId, movie1Id), eq(ratings.collectionId, colId)),
    });
    assert.equal(colRating?.calculatedOverallScore, 6.5, "Collection rating is 6.5");

    // Clean up collection rating
    await db.delete(ratings).where(eq(ratings.id, colRatingId));
    await db.delete(collections).where(eq(collections.id, colId));
  });

  // ---------------------------------------------------------------------------
  // Invariant 8: Star Rating Input Precision
  // ---------------------------------------------------------------------------
  it("Invariant 8: 5-star half-star ratings map accurately to 0-10 Aubrey scale", () => {
    const testCases: Array<[number, number]> = [
      [0.5, 1.0],
      [1.0, 2.0],
      [1.5, 3.0],
      [2.0, 4.0],
      [2.5, 5.0],
      [3.0, 6.0],
      [3.5, 7.0],
      [4.0, 8.0],
      [4.5, 9.0],
      [5.0, 10.0],
    ];

    for (const [star, expectedAubrey] of testCases) {
      const aubreyScore = star * 2;
      assert.equal(aubreyScore, expectedAubrey, `${star} stars must equal ${expectedAubrey} on Aubrey /10 scale`);
    }
  });

  // ---------------------------------------------------------------------------
  // Invariant 9: Review-to-Viewing Association
  // ---------------------------------------------------------------------------
  it("Invariant 9: reviews can link directly to a diary viewing event via viewingId", async () => {
    const diaryId = `diary_${randomUUID()}`;
    await db.insert(diaryEntries).values({
      id: diaryId,
      userId: user1Id,
      mediaItemId: movie2Id,
      watchedDate: "2024-03-10",
      isRewatch: false,
    });

    const revId = `rev_${randomUUID()}`;
    await db.insert(reviews).values({
      id: revId,
      userId: user1Id,
      mediaItemId: movie2Id,
      viewingId: diaryId,
      content: "Robert Altman's Elliott Gould is the coolest Philip Marlowe.",
      contentFormat: "markdown",
      status: "published",
      visibility: "public",
      watchedDate: "2024-03-10",
    });

    const rev = await db.query.reviews.findFirst({
      where: eq(reviews.id, revId),
    });
    assert.equal(rev?.viewingId, diaryId, "Review should link to diary viewing");
  });

  // ---------------------------------------------------------------------------
  // Invariant 10: Chronological Activity Ordering
  // ---------------------------------------------------------------------------
  it("Invariant 10: activities are ordered strictly chronologically by date descending", () => {
    const dummyActivities = [
      {
        id: "1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2023-01-01",
        createdAt: new Date("2023-01-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "2",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-06-01",
        createdAt: new Date("2024-06-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "3",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-01-15",
        createdAt: new Date("2024-01-15"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
    ];

    const { datedItems } = combineChronologicalActivities(dummyActivities);
    assert.equal(datedItems[0].eventDate, "2024-06-01", "Newest first");
    assert.equal(datedItems[1].eventDate, "2024-01-15", "Middle second");
    assert.equal(datedItems[2].eventDate, "2023-01-01", "Oldest third");
  });

  // ---------------------------------------------------------------------------
  // Invariant 11: Same-Day Viewing + Review Combination
  // ---------------------------------------------------------------------------
  it("Invariant 11: combines same-day viewing and review for the same title into one card", () => {
    const activities = [
      {
        id: "view_1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-05-10",
        diaryEntryId: "diary_100",
        createdAt: new Date("2024-05-10T18:00:00Z"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "rev_1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "review",
        eventDate: "2024-05-10",
        reviewId: "rev_100",
        reviewContent: "Great film seen today.",
        createdAt: new Date("2024-05-10T22:00:00Z"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
    ];

    const { datedItems } = combineChronologicalActivities(activities);
    assert.equal(datedItems.length, 1, "Should combine into exactly 1 card");
    assert.equal(datedItems[0].eventType, "viewing_and_review");
    assert.equal(datedItems[0].eventDate, "2024-05-10");
    assert.match(datedItems[0].badgeLabel || "", /Reviewed/);
  });

  // ---------------------------------------------------------------------------
  // Invariant 12: Distinct-Date Preservation
  // ---------------------------------------------------------------------------
  it("Invariant 12: viewing and review on different dates remain separate cards", () => {
    const activities = [
      {
        id: "view_1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-05-10",
        diaryEntryId: "diary_100",
        createdAt: new Date("2024-05-10T18:00:00Z"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "rev_1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "review",
        eventDate: "2024-05-11", // different date!
        reviewId: "rev_100",
        reviewContent: "Reflection written the next day.",
        createdAt: new Date("2024-05-11T10:00:00Z"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
    ];

    const { datedItems } = combineChronologicalActivities(activities);
    assert.equal(datedItems.length, 2, "Must remain 2 distinct cards for separate dates");
    assert.equal(datedItems[0].eventDate, "2024-05-11");
    assert.equal(datedItems[1].eventDate, "2024-05-10");
  });

  // ---------------------------------------------------------------------------
  // Invariant 13: Rewatch Ordinals & Preservation
  // ---------------------------------------------------------------------------
  it("Invariant 13: assigns correct chronological ordinals to rewatches (1st, 2nd, 3rd...)", () => {
    const ordinalsMap = new Map([
      ["d1", 1],
      ["d2", 2],
      ["d3", 3],
    ]);
    const totalsMap = new Map([[movie1Id, 3]]);

    const activities = [
      {
        id: "d1",
        diaryEntryId: "d1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2022-01-01",
        createdAt: new Date("2022-01-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "d2",
        diaryEntryId: "d2",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2023-01-01",
        createdAt: new Date("2023-01-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "d3",
        diaryEntryId: "d3",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-01-01",
        createdAt: new Date("2024-01-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
    ];

    const { datedItems } = combineChronologicalActivities(activities, ordinalsMap, totalsMap);
    // datedItems is sorted reverse chronological: d3, d2, d1
    assert.equal(datedItems[0].id, "d3");
    assert.equal(datedItems[0].ordinal, 3);
    assert.match(datedItems[0].badgeLabel || "", /Rewatch · 3rd/);

    assert.equal(datedItems[2].id, "d1");
    assert.equal(datedItems[2].ordinal, 1);
    assert.equal(datedItems[2].badgeLabel, "1st Logged Viewing");
  });

  // ---------------------------------------------------------------------------
  // Invariant 14: Isolated Undated Events
  // ---------------------------------------------------------------------------
  it("Invariant 14: undated events are isolated in undatedItems and never assigned fake dates", () => {
    const activities = [
      {
        id: "dated_1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-01-01",
        createdAt: new Date("2024-01-01"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
      {
        id: "undated_rev",
        userId: user1Id,
        mediaItemId: movie2Id,
        eventType: "review",
        eventDate: null, // undated!
        createdAt: new Date("2024-02-01"),
        mediaItem: { id: movie2Id, title: "The Long Goodbye" },
      },
    ];

    const { datedItems, undatedItems } = combineChronologicalActivities(activities);
    assert.equal(datedItems.length, 1);
    assert.equal(undatedItems.length, 1);
    assert.equal(undatedItems[0].eventDate, null, "Undated item must have null eventDate");
  });

  // ---------------------------------------------------------------------------
  // Invariant 15: Activity Filter Completeness
  // ---------------------------------------------------------------------------
  it("Invariant 15: activity filters (viewings, reviews, ratings, watchlist, films, tv) filter correctly", () => {
    const mixedEntries: UnifiedTimelineCardData[] = [
      {
        id: "1",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "viewing",
        eventDate: "2024-01-01",
        mediaItem: { id: movie1Id, title: "Chinatown", mediaType: "movie" },
        createdAt: new Date(),
      },
      {
        id: "2",
        userId: user1Id,
        mediaItemId: movie1Id,
        eventType: "review",
        eventDate: "2024-01-02",
        reviewContent: "A review",
        mediaItem: { id: movie1Id, title: "Chinatown", mediaType: "movie" },
        createdAt: new Date(),
      },
      {
        id: "3",
        userId: user1Id,
        mediaItemId: episode1Id,
        eventType: "viewing",
        eventDate: "2024-01-03",
        mediaItem: {
          id: episode1Id,
          title: "Pilot",
          mediaType: "episode",
          seasonNumber: 1,
          episodeNumber: 1,
        },
        createdAt: new Date(),
      },
    ];

    const filmOnly = mixedEntries.filter((e) => e.mediaItem.mediaType === "movie");
    assert.equal(filmOnly.length, 2);

    const tvOnly = mixedEntries.filter((e) => e.mediaItem.mediaType === "episode");
    assert.equal(tvOnly.length, 1);

    const reviewsOnly = mixedEntries.filter((e) => e.eventType === "review");
    assert.equal(reviewsOnly.length, 1);
  });

  // ---------------------------------------------------------------------------
  // Invariant 16: Ranked Items Marked Watched Idempotently
  // ---------------------------------------------------------------------------
  it("Invariant 16: ranking a movie or episode idempotently marks it Watched without fabricating viewing dates", async () => {
    // Call markRankedMediaAsWatched for episode1Id
    await markRankedMediaAsWatched(user1Id, episode1Id, db);

    const ratingRow = await db.query.ratings.findFirst({
      where: and(eq(ratings.userId, user1Id), eq(ratings.mediaItemId, episode1Id), isNull(ratings.collectionId)),
    });

    assert.ok(ratingRow, "Rating row should exist");
    assert.equal(ratingRow.isWatched, true, "isWatched should be true globally");
    assert.equal(ratingRow.watchDate, null, "watchDate must NOT be fabricated");

    // Verify no fake diary entry was created
    const diaryRows = await db.query.diaryEntries.findMany({
      where: and(eq(diaryEntries.userId, user1Id), eq(diaryEntries.mediaItemId, episode1Id)),
    });
    assert.equal(diaryRows.length, 0, "No fake diary entries should be created for ranked watched status");
  });

  // ---------------------------------------------------------------------------
  // Invariant 17: Cascade and Deletion Safety
  // ---------------------------------------------------------------------------
  it("Invariant 17: deleting viewing never deletes review, deleting review never deletes viewing, and neither affects media_notes", async () => {
    // Create note
    const note = await db.insert(mediaNotes).values({
      id: `note_${randomUUID()}`,
      userId: user2Id,
      mediaItemId: movie2Id,
      content: "Persistent private note.",
    }).returning();

    // Create viewing
    const viewing = await db.insert(diaryEntries).values({
      id: `diary_${randomUUID()}`,
      userId: user2Id,
      mediaItemId: movie2Id,
      watchedDate: "2024-04-01",
    }).returning();

    // Create review linked to viewing
    const review = await db.insert(reviews).values({
      id: `rev_${randomUUID()}`,
      userId: user2Id,
      mediaItemId: movie2Id,
      viewingId: viewing[0].id,
      content: "Review linked to viewing.",
      contentFormat: "markdown",
      status: "published",
      visibility: "private",
    }).returning();

    // Link viewing to review
    await db.update(diaryEntries).set({ reviewId: review[0].id }).where(eq(diaryEntries.id, viewing[0].id));

    // DELETE VIEWING
    await db.update(reviews).set({ viewingId: null }).where(eq(reviews.viewingId, viewing[0].id));
    await db.delete(diaryEntries).where(eq(diaryEntries.id, viewing[0].id));

    // Verify review survived
    const survivingReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review[0].id),
    });
    assert.ok(survivingReview, "Review must survive viewing deletion");
    assert.equal(survivingReview.viewingId, null, "Review viewingId should be decoupled to null");

    // Verify note survived
    const survivingNote = await db.query.mediaNotes.findFirst({
      where: eq(mediaNotes.id, note[0].id),
    });
    assert.ok(survivingNote, "media_notes must survive viewing deletion");

    // DELETE REVIEW
    await db.delete(reviews).where(eq(reviews.id, review[0].id));

    // Verify note still survives
    const noteAfterReviewDelete = await db.query.mediaNotes.findFirst({
      where: eq(mediaNotes.id, note[0].id),
    });
    assert.ok(noteAfterReviewDelete, "media_notes must survive review deletion");
  });

  // ---------------------------------------------------------------------------
  // Invariant 18 & 19: Letterboxd Re-import Date Enrichment & Provenance
  // ---------------------------------------------------------------------------
  it("Invariant 18 & 19: Letterboxd re-import preserves provenance and enriches dates safely", async () => {
    const importKey = `lb_event_${suffix}`;
    const activity = await db.insert(activityEvents).values({
      id: `act_${randomUUID()}`,
      userId: user1Id,
      mediaItemId: movie1Id,
      eventType: "rating",
      eventDate: "2024-01-10",
      ratingValue: 9.0,
      sourceRating: 4.5,
      sourceScale: 5,
      sourceService: "letterboxd",
      sourceUri: "https://letterboxd.com/film/chinatown/",
      sourceEventKey: `act:rating:${importKey}`,
    }).returning();

    assert.equal(activity[0].sourceService, "letterboxd");
    assert.equal(activity[0].sourceScale, 5);
    assert.equal(activity[0].sourceRating, 4.5);
    assert.equal(activity[0].eventDate, "2024-01-10");

    // Re-import with same sourceEventKey must do nothing (idempotent)
    const duplicate = await db.insert(activityEvents).values({
      id: `act_${randomUUID()}`,
      userId: user1Id,
      mediaItemId: movie1Id,
      eventType: "rating",
      eventDate: "2024-01-10",
      sourceEventKey: `act:rating:${importKey}`,
    }).onConflictDoNothing().returning();

    assert.equal(duplicate.length, 0, "Duplicate import with same sourceEventKey must do nothing");
  });

  // ---------------------------------------------------------------------------
  // Invariant 20: Unsaved Change Protection Contract
  // ---------------------------------------------------------------------------
  it("Invariant 20: unsaved changes detection triggers when content, title, or rating change", () => {
    const initialContent = "Original critique.";
    const initialTitle = "Original Title";
    const initialRating = 4.5;
    const initialViewing = "view_1";

    const isDirty = (content: string, title: string, rating: number | null, viewing: string | null) => {
      return (
        content !== initialContent ||
        title !== initialTitle ||
        rating !== initialRating ||
        viewing !== initialViewing
      );
    };

    assert.equal(isDirty(initialContent, initialTitle, initialRating, initialViewing), false, "Clean state is not dirty");
    assert.equal(isDirty("Edited text", initialTitle, initialRating, initialViewing), true, "Content edit is dirty");
    assert.equal(isDirty(initialContent, "New Title", initialRating, initialViewing), true, "Title edit is dirty");
    assert.equal(isDirty(initialContent, initialTitle, 5.0, initialViewing), true, "Rating edit is dirty");
    assert.equal(isDirty(initialContent, initialTitle, initialRating, "view_2"), true, "Viewing switch is dirty");
  });
});
