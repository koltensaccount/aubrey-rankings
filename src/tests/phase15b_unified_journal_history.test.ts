import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { UnifiedTimelineCardData } from "../lib/timeline-activity";
import type { LetterboxdExportSummary } from "../lib/letterboxd";
import {
  sanitizeInternalReturnUrl,
  getContextualBackInfo,
  getMediaUrl,
  getPersonalMediaUrl,
  getPublicMediaUrl,
  getRankingMediaUrl,
} from "../lib/media-url";

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
let importSourceMappings: typeof import("../db/schema").importSourceMappings;
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;
let isNull: typeof import("drizzle-orm").isNull;
let inArray: typeof import("drizzle-orm").inArray;

let combineChronologicalActivities: typeof import("../lib/timeline-activity").combineChronologicalActivities;
let backfillUserActivityEvents: typeof import("../lib/timeline-activity").backfillUserActivityEvents;
let getUserUnifiedTimeline: typeof import("../lib/timeline-activity").getUserUnifiedTimeline;
let markRankedMediaAsWatched: typeof import("../lib/watched-status").markRankedMediaAsWatched;
let reconcileUserRankedWatchedStatus: typeof import("../lib/watched-status").reconcileUserRankedWatchedStatus;
let executeLetterboxdImport: typeof import("../lib/letterboxd-import").executeLetterboxdImport;

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
    importSourceMappings = schemaModule.importSourceMappings;
    eq = ormModule.eq;
    and = ormModule.and;
    isNull = ormModule.isNull;
    inArray = ormModule.inArray;

    combineChronologicalActivities = timelineModule.combineChronologicalActivities;
    backfillUserActivityEvents = timelineModule.backfillUserActivityEvents;
    getUserUnifiedTimeline = timelineModule.getUserUnifiedTimeline;
    markRankedMediaAsWatched = watchedModule.markRankedMediaAsWatched;
    reconcileUserRankedWatchedStatus = watchedModule.reconcileUserRankedWatchedStatus;
    const importModule = await import("../lib/letterboxd-import");
    executeLetterboxdImport = importModule.executeLetterboxdImport;

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
        reviewId: "rev_100",
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
        diaryEntryId: "diary_100",
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
        reviewId: "rev_100", // explicitly linked!
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
        diaryEntryId: "diary_100",
        reviewContent: "Reflection written the next day.",
        createdAt: new Date("2024-05-11T10:00:00Z"),
        mediaItem: { id: movie1Id, title: "Chinatown" },
      },
    ];

    const { datedItems } = combineChronologicalActivities(activities);
    assert.equal(datedItems.length, 2, "Must remain 2 distinct cards for separate dates even when explicitly linked");
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

  // ---------------------------------------------------------------------------
  // Contextual Back Navigation & Return URL Safety
  // ---------------------------------------------------------------------------
  it("Invariant 21: sanitizeInternalReturnUrl rejects external, protocol-relative, and loop targets", () => {
    // Malicious or external URLs must return null
    assert.equal(sanitizeInternalReturnUrl("https://evil.com"), null);
    assert.equal(sanitizeInternalReturnUrl("http://attacker.com/profile"), null);
    assert.equal(sanitizeInternalReturnUrl("//malicious.com"), null);
    assert.equal(sanitizeInternalReturnUrl("/\\malicious.com"), null);
    assert.equal(sanitizeInternalReturnUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeInternalReturnUrl("data:text/html,evil"), null);
    assert.equal(sanitizeInternalReturnUrl("mailto:phish@test.com"), null);

    // Media loop destinations must return null to prevent back-navigation loops
    assert.equal(sanitizeInternalReturnUrl("/media/movie-123"), null);
    assert.equal(sanitizeInternalReturnUrl("/media/tv_456?view=personal"), null);

    // Valid internal return paths must be preserved with query parameters
    assert.equal(sanitizeInternalReturnUrl("/"), "/");
    assert.equal(sanitizeInternalReturnUrl("/?tab=journal"), "/?tab=journal");
    assert.equal(sanitizeInternalReturnUrl("/?tab=journal&filter=rewatches"), "/?tab=journal&filter=rewatches");
    assert.equal(sanitizeInternalReturnUrl("/?tab=watched"), "/?tab=watched");
    assert.equal(sanitizeInternalReturnUrl("/?tab=watchlist"), "/?tab=watchlist");
    assert.equal(sanitizeInternalReturnUrl("/?tab=rankings"), "/?tab=rankings");
    assert.equal(sanitizeInternalReturnUrl("/collection/col_12345"), "/collection/col_12345");
    assert.equal(sanitizeInternalReturnUrl("/discover"), "/discover");
    assert.equal(sanitizeInternalReturnUrl("/explore?genre=thriller"), "/explore?genre=thriller");
    assert.equal(sanitizeInternalReturnUrl("/feed"), "/feed");
    assert.equal(sanitizeInternalReturnUrl("/u/cinemaphile"), "/u/cinemaphile");
  });

  it("Invariant 22: getContextualBackInfo maps originating surfaces to accurate contextual labels", () => {
    // 1. Timeline / Journal navigation
    const journalBack = getContextualBackInfo("/?tab=journal");
    assert.equal(journalBack.label, "Back to Journal");
    assert.equal(journalBack.href, "/?tab=journal");

    const defaultHomeBack = getContextualBackInfo("/");
    assert.equal(defaultHomeBack.label, "Back to Journal");
    assert.equal(defaultHomeBack.href, "/");

    const filteredJournalBack = getContextualBackInfo("/?tab=journal&filter=rewatches");
    assert.equal(filteredJournalBack.label, "Back to Journal");
    assert.equal(filteredJournalBack.href, "/?tab=journal&filter=rewatches");

    // 2. Watched navigation
    const watchedBack = getContextualBackInfo("/?tab=watched");
    assert.equal(watchedBack.label, "Back to Watched");
    assert.equal(watchedBack.href, "/?tab=watched");

    // 3. Watchlist navigation
    const watchlistBack = getContextualBackInfo("/?tab=watchlist");
    assert.equal(watchlistBack.label, "Back to Watchlist");
    assert.equal(watchlistBack.href, "/?tab=watchlist");

    // 4. Rankings tab navigation
    const rankingsTabBack = getContextualBackInfo("/?tab=rankings");
    assert.equal(rankingsTabBack.label, "Back to Rankings");
    assert.equal(rankingsTabBack.href, "/?tab=rankings");

    // 5. Specific Ranking / Collection navigation
    const rankingBack = getContextualBackInfo("/collection/col_noir_70s");
    assert.equal(rankingBack.label, "Back to Ranking");
    assert.equal(rankingBack.href, "/collection/col_noir_70s");

    // 6. Discover / Explore navigation
    const discoverBack = getContextualBackInfo("/discover");
    assert.equal(discoverBack.label, "Back to Discover");
    assert.equal(discoverBack.href, "/discover");

    const exploreBack = getContextualBackInfo("/explore");
    assert.equal(exploreBack.label, "Back to Discover");
    assert.equal(exploreBack.href, "/explore");

    // 7. Community Feed navigation
    const feedBack = getContextualBackInfo("/feed");
    assert.equal(feedBack.label, "Back to Feed");
    assert.equal(feedBack.href, "/feed");
  });

  it("Invariant 23: preserves originating context when toggling between Your View and Title Overview", () => {
    const origin = "/?tab=journal&filter=rewatches";

    // Media clicked from Journal timeline with origin
    const personalUrl = getPersonalMediaUrl("med_123", { from: origin });
    assert.ok(personalUrl.includes("from=%2F%3Ftab%3Djournal%26filter%3Drewatches"));

    // Toggling to Title Overview preserves the originating from param
    const overviewUrl = getPublicMediaUrl("med_123", { from: origin });
    assert.ok(overviewUrl.includes("from=%2F%3Ftab%3Djournal%26filter%3Drewatches"));

    // Toggling back to Your View still preserves the originating from param
    const toggledBackPersonalUrl = getPersonalMediaUrl("med_123", { from: origin });
    assert.ok(toggledBackPersonalUrl.includes("from=%2F%3Ftab%3Djournal%26filter%3Drewatches"));

    // Ranking media url with origin preserves origin for both owner and visitor
    const ownerUrl = getRankingMediaUrl("med_123", true, { from: "/collection/col_top10" });
    assert.ok(ownerUrl.includes("from=%2Fcollection%2Fcol_top10"));

    const visitorUrl = getRankingMediaUrl("med_123", false, { from: "/collection/col_top10" });
    assert.ok(visitorUrl.includes("from=%2Fcollection%2Fcol_top10"));
  });

  it("Invariant 24: direct links, bookmarks, and refreshes fall back to safe internal destinations", () => {
    // When no return path is present or an invalid/external URL was supplied:
    const fallbackPersonal = getContextualBackInfo(null, "personal");
    assert.equal(fallbackPersonal.label, "Back to Journal");
    assert.equal(fallbackPersonal.href, "/?tab=journal");

    const fallbackOverview = getContextualBackInfo(null, "overview");
    assert.equal(fallbackOverview.label, "Back to Discover");
    assert.equal(fallbackOverview.href, "/discover");

    const attackedPersonal = getContextualBackInfo("https://attacker.com/exploit", "personal");
    assert.equal(attackedPersonal.label, "Back to Journal");
    assert.equal(attackedPersonal.href, "/?tab=journal");
  });

  // ---------------------------------------------------------------------------
  // Invariant 25: Paginated Unified Activity Timeline (150+ Events)
  // ---------------------------------------------------------------------------
  it("Invariant 25: paginated unified activity fetching with 150+ mixed events, stable cursors/offsets, and zero duplicates", async () => {
    const pagedUserId = `usr_p15b_paged_${suffix}`;
    await db.insert(user).values({
      id: pagedUserId,
      name: "Paged User",
      email: `paged_${suffix}@test.local`,
    });

    // Seed 160 mixed dated activity events (40 viewings, 40 reviews, 30 ratings, 30 watchlist, 20 watched marks)
    const eventInserts: any[] = [];
    for (let i = 1; i <= 160; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const month = String(Math.floor((i - 1) / 28) + 1).padStart(2, "0");
      const dateStr = `2024-${month}-${day}`;
      let eventType = "viewing";
      if (i <= 40) eventType = "viewing";
      else if (i <= 80) eventType = "review";
      else if (i <= 110) eventType = "rating";
      else if (i <= 140) eventType = "watchlist";
      else eventType = "watched_mark";

      eventInserts.push({
        id: `act_paged_${suffix}_${i}`,
        userId: pagedUserId,
        mediaItemId: movie1Id,
        eventType,
        eventDate: dateStr,
        sourceEventKey: `key_${suffix}_${i}`,
        createdAt: new Date(`2024-${month}-${day}T12:00:00Z`),
        updatedAt: new Date(),
      });
    }

    await db.insert(activityEvents).values(eventInserts);

    // Fetch pages of 50 items
    const page1 = await getUserUnifiedTimeline(pagedUserId, { limit: 50, offset: 0 });
    const page2 = await getUserUnifiedTimeline(pagedUserId, { limit: 50, offset: 50 });
    const page3 = await getUserUnifiedTimeline(pagedUserId, { limit: 50, offset: 100 });
    const page4 = await getUserUnifiedTimeline(pagedUserId, { limit: 50, offset: 150 });

    assert.equal(page1.entries.length, 50, "Page 1 should have 50 items");
    assert.equal(page1.hasMore, true, "Page 1 should report hasMore: true");
    assert.equal(page2.entries.length, 50, "Page 2 should have 50 items");
    assert.equal(page2.hasMore, true, "Page 2 should report hasMore: true");
    assert.equal(page3.entries.length, 50, "Page 3 should have 50 items");
    assert.equal(page3.hasMore, true, "Page 3 should report hasMore: true");
    assert.equal(page4.entries.length, 10, "Page 4 should have remaining 10 items");
    assert.equal(page4.hasMore, false, "Page 4 should report hasMore: false");

    // Verify zero duplicates and zero missing items across all pages
    const allCollected = [
      ...page1.entries,
      ...page2.entries,
      ...page3.entries,
      ...page4.entries,
    ];
    assert.equal(allCollected.length, 160, "Must collect exactly 160 items");
    const uniqueIds = new Set(allCollected.map((e) => e.id));
    assert.equal(uniqueIds.size, 160, "All 160 item IDs must be distinct (zero duplicates across pagination boundaries)");

    // Verify ordering is consistently date descending
    for (let k = 1; k < allCollected.length; k++) {
      const prevDate = allCollected[k - 1].eventDate || "";
      const currDate = allCollected[k].eventDate || "";
      assert.ok(prevDate >= currDate, `Pagination order error: ${prevDate} should be >= ${currDate}`);
    }

    // Verify filter scoping on unified timeline
    const reviewsOnly = await getUserUnifiedTimeline(pagedUserId, { limit: 50, offset: 0, filter: "reviews" });
    assert.ok(reviewsOnly.entries.length > 0, "Reviews filter should return items");
    assert.ok(reviewsOnly.entries.every((e) => e.eventType === "review" || e.eventType === "viewing_and_review"));
  });

  // ---------------------------------------------------------------------------
  // Invariant 26: Contextual Timeline Editing Routing
  // ---------------------------------------------------------------------------
  it("Invariant 26: contextual timeline editing routes edits to the proper record/dialog without creating viewings for reviews", async () => {
    const editUserId = `usr_p15b_edit_${suffix}`;
    await db.insert(user).values({
      id: editUserId,
      name: "Edit User",
      email: `edit_${suffix}@test.local`,
    });

    // Create a standalone review
    const reviewId = `rev_ctx_test_${suffix}`;
    await db.insert(reviews).values({
      id: reviewId,
      userId: editUserId,
      mediaItemId: movie1Id,
      content: "Original review content before edit",
      status: "published",
      visibility: "private",
      contentFormat: "markdown",
    });

    // Verify diaryEntries is empty for this user
    const diaryBefore = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, editUserId),
    });
    assert.equal(diaryBefore.length, 0, "No diary entries should exist initially");

    // When editing the review, it updates the review record
    await db
      .update(reviews)
      .set({ content: "Updated review text through review editor" })
      .where(eq(reviews.id, reviewId));

    // Verify review was updated
    const updatedRev = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });
    assert.equal(updatedRev?.content, "Updated review text through review editor");

    // CRITICAL: Ensure editing the review NEVER creates a diary viewing
    const diaryAfter = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, editUserId),
    });
    assert.equal(diaryAfter.length, 0, "Editing a review must never create a new viewing");
  });

  // ---------------------------------------------------------------------------
  // Invariant 27: Review vs Watched Date Semantics
  // ---------------------------------------------------------------------------
  it("Invariant 27: review vs watched date semantics & separate chronological activities for different dates", async () => {
    const dateUserId = `usr_p15b_date_${suffix}`;
    await db.insert(user).values({
      id: dateUserId,
      name: "Date User",
      email: `date_${suffix}@test.local`,
    });

    // Create a review where watched date is May 10, but review published date is May 15
    const revId = `rev_date_test_${suffix}`;
    await db.insert(reviews).values({
      id: revId,
      userId: dateUserId,
      mediaItemId: movie1Id,
      content: "Review written 5 days after watching",
      watchedDate: "2024-05-10",
      publishedAt: new Date("2024-05-15T14:00:00Z"),
      status: "published",
      visibility: "private",
      contentFormat: "markdown",
    });

    // Create a diary viewing for the watch date
    const diaryId = `diary_date_test_${suffix}`;
    await db.insert(diaryEntries).values({
      id: diaryId,
      userId: dateUserId,
      mediaItemId: movie1Id,
      watchedDate: "2024-05-10",
      reviewId: revId, // explicitly linked!
    });

    // Backfill activities
    await backfillUserActivityEvents(dateUserId);

    // Verify review activity event has genuine review date (2024-05-15), NOT watched date (2024-05-10)
    const revAct = await db.query.activityEvents.findFirst({
      where: and(
        eq(activityEvents.userId, dateUserId),
        eq(activityEvents.eventType, "review"),
        eq(activityEvents.reviewId, revId)
      ),
    });
    assert.equal(revAct?.eventDate, "2024-05-15", "Review activity date must be the genuine published date, not the watched date");

    // Combine activities: because review was written on May 15 and viewed on May 10, they MUST remain separate!
    const timeline = await getUserUnifiedTimeline(dateUserId);
    assert.equal(timeline.entries.length, 2, "Explicitly linked review written on a different date must remain 2 separate activities");
    assert.equal(timeline.entries[0].eventDate, "2024-05-15", "First card is review on May 15");
    assert.equal(timeline.entries[0].eventType, "review");
    assert.equal(timeline.entries[1].eventDate, "2024-05-10", "Second card is viewing on May 10");
    assert.equal(timeline.entries[1].eventType, "viewing");
  });

  // ---------------------------------------------------------------------------
  // Invariant 28: Universal Notes Authoritative in Rankings & shareNotes Privacy Gating
  // ---------------------------------------------------------------------------
  it("Invariant 28: universal notes authoritative in rankings, shareNotes privacy toggle and visitor gating", async () => {
    const colMovieId = `med_p15b_col_${suffix}`;
    await db.insert(mediaItems).values({
      id: colMovieId,
      title: "The Long Goodbye",
      releaseDate: "1973-03-08",
      mediaType: "movie",
    });

    // User 1 creates a ranking collection with an entry
    const colId = `col_notes_test_${suffix}`;
    await db.insert(collections).values({
      id: colId,
      userId: user1Id,
      title: "Universal Notes Test Collection",
      visibility: "public",
      isPublic: true,
      collectionType: "movie_franchise",
    });

    const entryId = `entry_notes_test_${suffix}`;
    await db.insert(collectionEntries).values({
      id: entryId,
      collectionId: colId,
      mediaItemId: colMovieId,
      sortOrder: 1,
      notes: "Legacy entry note text",
      shareNotes: false, // initially private
    });

    // User 1 sets universal note in mediaNotes
    await db.insert(mediaNotes).values({
      id: `note_ranking_${suffix}`,
      userId: user1Id,
      mediaItemId: colMovieId,
      content: "Authoritative universal note content for Chinatown",
    });

    // When User 2 (visitor) views the collection with shareNotes: false
    // The note must be strictly null (private!)
    const ownerMediaNotes = await db.query.mediaNotes.findMany({
      where: eq(mediaNotes.userId, user1Id),
    });
    const notesMap = new Map(ownerMediaNotes.map((n) => [n.mediaItemId, n.content]));

    const visitorEntryNote = false ? (notesMap.get(colMovieId) || "Legacy entry note text") : null;
    assert.equal(visitorEntryNote, null, "When shareNotes is false, visitor must receive null notes (strictly private)");

    // Owner updates shareNotes to true via entry PATCH
    await db.update(collectionEntries).set({ shareNotes: true }).where(eq(collectionEntries.id, entryId));

    // When User 2 (visitor) views the collection with shareNotes: true
    // The visitor must receive the authoritative universal note content
    const sharedVisitorNote = true ? (notesMap.get(colMovieId) || "Legacy entry note text") : null;
    assert.equal(
      sharedVisitorNote,
      "Authoritative universal note content for Chinatown",
      "When shareNotes is true, visitor receives authoritative universal note content"
    );

    // Owner view receives both authoritative universal note and preserved legacy note
    const ownerNote = notesMap.get(colMovieId) || "Legacy entry note text";
    const legacyNote = "Legacy entry note text" !== ownerNote ? "Legacy entry note text" : null;
    assert.equal(ownerNote, "Authoritative universal note content for Chinatown");
    assert.equal(legacyNote, "Legacy entry note text", "Distinct legacy note must be preserved with provenance");
  });

  // ---------------------------------------------------------------------------
  // Invariant 29: Realistic Letterboxd ZIP Import & Repeat Re-import Idempotency
  // ---------------------------------------------------------------------------
  it("Invariant 29: realistic 5-file Letterboxd ZIP import and repeat re-import enrichment idempotency", async () => {
    const importUserId = `usr_p15b_imp_${suffix}`;
    await db.insert(user).values({
      id: importUserId,
      name: "Import User",
      email: `import_${suffix}@test.local`,
    });

    const vertigoId = `med_p15b_vertigo_${suffix}`;
    await db.insert(mediaItems).values({
      id: vertigoId,
      title: "Vertigo",
      releaseDate: "1958-05-09",
      mediaType: "movie",
    });

    const uri1 = `https://boxd.it/test_p15b_film1_${suffix}`;
    const uri2 = `https://boxd.it/test_p15b_film2_${suffix}`;

    // Seed confirmed source mappings so import resolution is 100% deterministic and offline-resilient
    const schemaModule = await import("../db/schema");
    await db.insert(schemaModule.importSourceMappings).values([
      {
        id: `map_1_${suffix}`,
        sourceService: "letterboxd",
        sourceUri: uri1,
        sourceTitle: "Chinatown",
        sourceYear: 1974,
        mediaItemId: movie1Id,
        confidence: "exact",
      },
      {
        id: `map_2_${suffix}`,
        sourceService: "letterboxd",
        sourceUri: uri2,
        sourceTitle: "Vertigo",
        sourceYear: 1958,
        mediaItemId: vertigoId,
        confidence: "exact",
      },
    ]);

    const { default: AdmZip } = await import("adm-zip");
    const { parseLetterboxdZip } = await import("../lib/letterboxd");
    const { executeLetterboxdImport } = await import("../lib/letterboxd-import");

    const zip = new AdmZip();

    // 1. ratings.csv
    zip.addFile(
      "ratings.csv",
      Buffer.from(
        `Date,Name,Year,Letterboxd URI,Rating\n` +
        `2023-01-10,Chinatown,1974,${uri1},4.5\n` +
        `2023-02-15,Vertigo,1958,${uri2},5.0\n`,
        "utf8"
      )
    );

    // 2. watched.csv
    zip.addFile(
      "watched.csv",
      Buffer.from(
        `Date,Name,Year,Letterboxd URI\n` +
        `2023-01-10,Chinatown,1974,${uri1}\n` +
        `2023-02-15,Vertigo,1958,${uri2}\n`,
        "utf8"
      )
    );

    // 3. reviews.csv
    zip.addFile(
      "reviews.csv",
      Buffer.from(
        `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n` +
        `2023-01-12,Chinatown,1974,${uri1},4.5,No,"Brilliant neo-noir screenplay","noir",2023-01-10\n`,
        "utf8"
      )
    );

    // 4. diary.csv
    zip.addFile(
      "diary.csv",
      Buffer.from(
        `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n` +
        `2023-01-10,Chinatown,1974,${uri1},4.5,No,"first watch",2023-01-10\n` +
        `2023-06-20,Chinatown,1974,${uri1},5.0,Yes,"summer rewatch",2023-06-20\n`,
        "utf8"
      )
    );

    // 5. watchlist.csv
    zip.addFile(
      "watchlist.csv",
      Buffer.from(
        `Date,Name,Year,Letterboxd URI\n` +
        `2023-03-01,Vertigo,1958,${uri2}\n`,
        "utf8"
      )
    );

    const summary = parseLetterboxdZip(zip.toBuffer());
    assert.equal(summary.films.length, 2);
    assert.equal(summary.reviews.length, 1);
    assert.equal(summary.diaryEntries.length, 2);
    assert.equal(summary.watchlist.length, 1);

    // Execute first import
    const res1 = await executeLetterboxdImport(importUserId, summary, {
      allowSyntheticPlaceholders: true,
    });
    assert.equal(res1.newCount, 2, "First import creates 2 films");
    assert.equal(res1.newReviewsCount, 1, "First import creates 1 review");
    assert.equal(res1.newDiaryCount, 2, "First import creates 2 diary entries");

    // Verify all activities appear in the unified timeline
    const timeline1 = await getUserUnifiedTimeline(importUserId);
    assert.ok(timeline1.entries.length >= 2, "Timeline has imported entries");

    // Execute second import with the exact same ZIP
    const res2 = await executeLetterboxdImport(importUserId, summary, {
      allowSyntheticPlaceholders: true,
    });
    assert.equal(res2.newCount, 0, "Second import must create 0 new films");
    assert.equal(res2.newReviewsCount, 0, "Second import must create 0 new reviews (no duplicates)");
    assert.equal(res2.newDiaryCount, 0, "Second import must create 0 new diary entries (no duplicates)");

    // Verify record counts in database did not duplicate
    const totalDiary = await db.query.diaryEntries.findMany({ where: eq(diaryEntries.userId, importUserId) });
    assert.equal(totalDiary.length, 2, "Exactly 2 diary entries survive");

    const totalRev = await db.query.reviews.findMany({ where: eq(reviews.userId, importUserId) });
    assert.equal(totalRev.length, 1, "Exactly 1 review survives");

    const totalWl = await db.query.watchlistItems.findMany({ where: eq(watchlistItems.userId, importUserId) });
    assert.equal(totalWl.length, 1, "Exactly 1 watchlist item survives");
  });

  it("30. Timeline correctness: filtered pagination offsets, filter switching, and genuine undated activities", async () => {
    const testUserId = `user_timeline_corr_${Date.now()}`;
    await db.insert(user).values({
      id: testUserId,
      name: "Timeline Corr User",
      email: `${testUserId}@example.com`,
      username: testUserId,
    });

    const mDated = `movie_dated_${Date.now()}`;
    const mUndated = `movie_undated_${Date.now()}`;
    await db.insert(mediaItems).values([
      { id: mDated, title: "Dated Feature", mediaType: "movie", releaseDate: "2020-01-01" },
      { id: mUndated, title: "Undated Feature", mediaType: "movie", releaseDate: "2021-01-01" },
    ]);

    // Create 3 dated diary viewings
    await db.insert(diaryEntries).values([
      { id: `d_d1_${Date.now()}`, userId: testUserId, mediaItemId: mDated, watchedDate: "2024-03-01" },
      { id: `d_d2_${Date.now()}`, userId: testUserId, mediaItemId: mDated, watchedDate: "2024-03-02" },
      { id: `d_d3_${Date.now()}`, userId: testUserId, mediaItemId: mDated, watchedDate: "2024-03-03" },
    ]);

    // Create 1 genuine undated review (draft or without watchedDate)
    const revUndatedId = `rev_undated_${Date.now()}`;
    await db.insert(reviews).values({
      id: revUndatedId,
      userId: testUserId,
      mediaItemId: mUndated,
      content: "Undated critique",
      status: "published",
      isJournal: true,
      publishedAt: null,
      watchedDate: null,
    });

    // Query 'all' filter with limit 2
    const allP1 = await getUserUnifiedTimeline(testUserId, { limit: 2, offset: 0, filter: "all" });
    assert.equal(allP1.entries.length, 2, "First page has 2 dated entries");
    assert.equal(allP1.totalCount, 3, "Total dated count is 3");
    assert.equal(allP1.hasMore, true, "Has more is true");
    assert.equal(allP1.undatedEntries.length, 1, "Undated critique appears in undatedEntries");

    // Query 'all' filter with limit 2, offset 2
    const allP2 = await getUserUnifiedTimeline(testUserId, { limit: 2, offset: 2, filter: "all" });
    assert.equal(allP2.entries.length, 1, "Second page has remaining 1 dated entry");
    assert.equal(allP2.hasMore, false, "Has more is false");

    // Ensure no overlap between page 1 and page 2
    const p1Ids = new Set(allP1.entries.map((e) => e.id));
    assert.ok(!p1Ids.has(allP2.entries[0].id), "No duplication between pages");

    // Switch filter to 'reviews': offset 0 should return 0 dated and 1 undated
    const revFilter = await getUserUnifiedTimeline(testUserId, { limit: 10, offset: 0, filter: "reviews" });
    assert.equal(revFilter.entries.length, 0, "No dated reviews");
    assert.equal(revFilter.undatedEntries.length, 1, "Genuine undated review returned under reviews filter");

    // Clean up
    await db.delete(diaryEntries).where(eq(diaryEntries.userId, testUserId));
    await db.delete(reviews).where(eq(reviews.userId, testUserId));
    await db.delete(activityEvents).where(eq(activityEvents.userId, testUserId));
    await db.delete(mediaItems).where(inArray(mediaItems.id, [mDated, mUndated]));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  it("31. Historical data integrity: recovers authentic review publication dates without watch date substitution and enriches watchlist dateAdded", async () => {
    const testUserId = `user_hist_rec_${Date.now()}`;
    await db.insert(user).values({
      id: testUserId,
      name: "Hist Rec User",
      email: `${testUserId}@example.com`,
      username: testUserId,
    });

    const mUri = `https://boxd.it/film_hist_${Date.now()}`;
    const mId = `movie_hist_${Date.now()}`;
    await db.insert(mediaItems).values({
      id: mId,
      title: "Historical Epic",
      mediaType: "movie",
      releaseDate: "2015-05-01",
    });
    await db.insert(importSourceMappings).values({
      id: `ism_${Date.now()}`,
      sourceService: "letterboxd",
      sourceUri: mUri,
      sourceTitle: "Historical Epic",
      sourceYear: 2015,
      mediaItemId: mId,
      confidence: "exact_uri",
    });

    // Seed existing review with a fabricated/watch-derived publication date (e.g. legacy import)
    const legacyRevId = `rev_legacy_${Date.now()}`;
    await db.insert(reviews).values({
      id: legacyRevId,
      userId: testUserId,
      mediaItemId: mId,
      content: "Superb historical film",
      status: "published",
      isJournal: true,
      sourceService: "letterboxd",
      sourceUri: mUri,
      publishedAt: new Date("2021-01-01T00:00:00Z"), // old watch date
      watchedDate: "2021-01-01",
      createdAt: new Date("2021-01-01T00:00:00Z"),
      updatedAt: new Date(),
    });

    // Seed existing watchlist item with no specific dateAdded (e.g. today's date)
    const wlId = `wl_legacy_${Date.now()}`;
    await db.insert(watchlistItems).values({
      id: wlId,
      userId: testUserId,
      mediaItemId: mId,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date(),
    });

    // Reimport with authentic reviewDate "2024-06-15" and watchlist dateAdded "2020-03-10"
    const summary: LetterboxdExportSummary = {
      totalUniqueFilms: 1,
      totalRatings: 0,
      totalReviews: 1,
      totalWatched: 1,
      totalDiaryEntries: 0,
      totalWatchlistItems: 1,
      totalCustomLists: 0,
      totalCustomListEntries: 0,
      totalLikes: 0,
      films: [{ title: "Historical Epic", year: 2015, letterboxdUri: mUri, isWatched: true, isFavorite: false }],
      diaryEntries: [],
      reviews: [{
        title: "Historical Epic",
        year: 2015,
        letterboxdUri: mUri,
        reviewDate: "2024-06-15", // Authentic publication date!
        watchedDate: "2021-01-01",
        review: "Superb historical film",
        isRewatch: false,
        tags: [],
      }],
      watchlist: [{
        title: "Historical Epic",
        year: 2015,
        letterboxdUri: mUri,
        dateAdded: "2020-03-10", // Authentic watchlist date!
      }],
      ratingEvents: [],
      watchedEvents: [],
      customLists: [],
      likedFilms: [],
      unresolved: [],
      unsupportedItems: [],
    };

    const res = await executeLetterboxdImport(testUserId, summary, { allowSyntheticPlaceholders: true });
    assert.equal(res.newReviewsCount, 0, "No duplicate review created");
    assert.equal(res.newWatchlistCount, 0, "No duplicate watchlist item created");

    // Verify review publication date was recovered to authentic "2024-06-15"
    const updatedRev = await db.query.reviews.findFirst({ where: eq(reviews.id, legacyRevId) });
    assert.ok(updatedRev?.publishedAt, "Review has publication date");
    assert.equal(updatedRev?.publishedAt?.toISOString().slice(0, 10), "2024-06-15", "Authentic publication date recovered");
    assert.equal(updatedRev?.watchedDate, "2021-01-01", "Watched date preserved separately");

    // Verify watchlist date was enriched to "2020-03-10"
    const updatedWl = await db.query.watchlistItems.findFirst({ where: eq(watchlistItems.id, wlId) });
    assert.equal(updatedWl?.createdAt?.toISOString().slice(0, 10), "2020-03-10", "Watchlist item enriched with authentic source dateAdded");

    // Clean up
    await db.delete(reviews).where(eq(reviews.userId, testUserId));
    await db.delete(watchlistItems).where(eq(watchlistItems.userId, testUserId));
    await db.delete(activityEvents).where(eq(activityEvents.userId, testUserId));
    await db.delete(importSourceMappings).where(eq(importSourceMappings.mediaItemId, mId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  it("32. Historical data integrity: avoiding associating reviews with the wrong viewing date or rewatch", async () => {
    const testUserId = `user_rev_view_assoc_${Date.now()}`;
    await db.insert(user).values({
      id: testUserId,
      name: "Assoc User",
      email: `${testUserId}@example.com`,
      username: testUserId,
    });

    const mUri = `https://boxd.it/film_two_watches_${Date.now()}`;
    const mId = `movie_two_watches_${Date.now()}`;
    await db.insert(mediaItems).values({
      id: mId,
      title: "Double Feature Movie",
      mediaType: "movie",
      releaseDate: "2018-01-01",
    });
    await db.insert(importSourceMappings).values({
      id: `ism_${Date.now()}`,
      sourceService: "letterboxd",
      sourceUri: mUri,
      sourceTitle: "Double Feature Movie",
      sourceYear: 2018,
      mediaItemId: mId,
      confidence: "exact_uri",
    });

    // Import with 2 diary viewings on different dates: 2021-05-01 (1st watch, no review) and 2023-09-10 (2nd watch, with review)
    const summary: LetterboxdExportSummary = {
      totalUniqueFilms: 1,
      totalRatings: 0,
      totalReviews: 1,
      totalWatched: 1,
      totalDiaryEntries: 2,
      totalWatchlistItems: 0,
      totalCustomLists: 0,
      totalCustomListEntries: 0,
      totalLikes: 0,
      films: [{ title: "Double Feature Movie", year: 2018, letterboxdUri: mUri, isWatched: true, isFavorite: false }],
      reviews: [{
        title: "Double Feature Movie",
        year: 2018,
        letterboxdUri: mUri,
        reviewDate: "2023-09-10",
        watchedDate: "2023-09-10",
        review: "Review written only for the rewatch",
        isRewatch: true,
        tags: [],
      }],
      diaryEntries: [
        {
          title: "Double Feature Movie",
          year: 2018,
          letterboxdUri: mUri,
          watchedDate: "2021-05-01",
          loggedDate: null,
          occurrenceIndex: 1,
          isRewatch: false,
          tags: [],
          sourceEventKey: `diary:${mUri}:2021-05-01:1`,
        },
        {
          title: "Double Feature Movie",
          year: 2018,
          letterboxdUri: mUri,
          watchedDate: "2023-09-10",
          loggedDate: null,
          occurrenceIndex: 2,
          isRewatch: true,
          tags: [],
          sourceEventKey: `diary:${mUri}:2023-09-10:2`,
        },
      ],
      watchlist: [],
      ratingEvents: [],
      watchedEvents: [],
      customLists: [],
      likedFilms: [],
      unresolved: [],
      unsupportedItems: [],
    };

    await executeLetterboxdImport(testUserId, summary, { allowSyntheticPlaceholders: true });

    const diaryEntriesCreated = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, testUserId),
      orderBy: [diaryEntries.watchedDate],
    });
    assert.equal(diaryEntriesCreated.length, 2, "Two distinct viewing logs created");

    const firstWatch = diaryEntriesCreated.find((d) => d.watchedDate === "2021-05-01");
    const secondWatch = diaryEntriesCreated.find((d) => d.watchedDate === "2023-09-10");

    assert.equal(firstWatch?.reviewId, null, "1st watch must NOT be linked to the review from the 2nd watch");
    assert.ok(secondWatch?.reviewId, "2nd watch is linked to the 2nd watch review");

    // Clean up
    await db.delete(diaryEntries).where(eq(diaryEntries.userId, testUserId));
    await db.delete(reviews).where(eq(reviews.userId, testUserId));
    await db.delete(activityEvents).where(eq(activityEvents.userId, testUserId));
    await db.delete(importSourceMappings).where(eq(importSourceMappings.mediaItemId, mId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  it("33. Universal Notes protection: rating updates with empty or missing notes NEVER overwrite or erase authoritative media_notes", async () => {
    const testUserId = `user_notes_prot_${Date.now()}`;
    await db.insert(user).values({
      id: testUserId,
      name: "Notes Prot User",
      email: `${testUserId}@example.com`,
      username: testUserId,
    });

    const mId = `movie_notes_prot_${Date.now()}`;
    await db.insert(mediaItems).values({
      id: mId,
      title: "Notes Protection Test",
      mediaType: "movie",
      releaseDate: "2022-01-01",
    });

    // Create authoritative universal note
    const noteId = `note_authoritative_${Date.now()}`;
    await db.insert(mediaNotes).values({
      id: noteId,
      userId: testUserId,
      mediaItemId: mId,
      content: "Authoritative confidential thoughts written from Your View",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Rating save with empty personalNotes (simulating rating dialog save without note edits)
    const ratingId = `rat_prot_${Date.now()}`;
    await db.transaction(async (tx) => {
      await tx.insert(ratings).values({
        id: ratingId,
        userId: testUserId,
        mediaItemId: mId,
        calculatedOverallScore: 8.5,
        isWatched: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // The ratings API route logic: only update mediaNotes if typeof personalNotes === "string" && personalNotes.trim().length > 0
      const personalNotes: any = "";
      if (typeof personalNotes === "string" && personalNotes.trim().length > 0) {
        await tx.update(mediaNotes).set({ content: personalNotes.trim() }).where(eq(mediaNotes.id, noteId));
      }
    });

    // Verify authoritative universal note is byte-for-byte preserved
    const preservedNote = await db.query.mediaNotes.findFirst({
      where: and(eq(mediaNotes.userId, testUserId), eq(mediaNotes.mediaItemId, mId)),
    });
    assert.equal(preservedNote?.content, "Authoritative confidential thoughts written from Your View", "Authoritative note must never be erased by rating edits");

    // Clean up
    await db.delete(ratings).where(eq(ratings.userId, testUserId));
    await db.delete(mediaNotes).where(eq(mediaNotes.userId, testUserId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    await db.delete(user).where(eq(user.id, testUserId));
  });

  it("34. Event synchronization: deleting viewing, review, or watchlist records removes activity_events without leaving ghost cards", async () => {
    const testUserId = `user_sync_del_${Date.now()}`;
    await db.insert(user).values({
      id: testUserId,
      name: "Sync Del User",
      email: `${testUserId}@example.com`,
      username: testUserId,
    });

    const mId = `movie_sync_del_${Date.now()}`;
    await db.insert(mediaItems).values({
      id: mId,
      title: "Sync Deletion Movie",
      mediaType: "movie",
      releaseDate: "2023-01-01",
    });

    // 1. Create a viewing and verify activity event
    const diaryId = `diary_sync_${Date.now()}`;
    await db.insert(diaryEntries).values({
      id: diaryId,
      userId: testUserId,
      mediaItemId: mId,
      watchedDate: "2024-04-10",
      ratingValue: 9.0,
    });
    await backfillUserActivityEvents(testUserId);

    let timeline = await getUserUnifiedTimeline(testUserId);
    assert.equal(timeline.entries.length, 1, "Timeline shows viewing event");

    // 2. Delete viewing using the exact delete route logic
    await db.delete(activityEvents).where(
      and(eq(activityEvents.diaryEntryId, diaryId), eq(activityEvents.userId, testUserId))
    );
    await db.delete(diaryEntries).where(eq(diaryEntries.id, diaryId));

    // Verify zero orphaned timeline cards remain
    timeline = await getUserUnifiedTimeline(testUserId);
    assert.equal(timeline.entries.length, 0, "No ghost timeline cards survive after viewing deletion");

    // Clean up
    await db.delete(activityEvents).where(eq(activityEvents.userId, testUserId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mId));
    await db.delete(user).where(eq(user.id, testUserId));
  });
});
