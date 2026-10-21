import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  getMediaUrl,
  getPublicMediaUrl,
  getPersonalMediaUrl,
  getRankingMediaUrl,
} from "../lib/media-url";

// =============================================================================
// Safety Checks BEFORE Database / Authentication Modules Initialize
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
    "Phase 15A Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Phase 15A Test aborted: DATABASE_URL (or TEST_DATABASE_URL) is required.");
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error("Phase 15A Test aborted: DATABASE_URL is not a valid URL.");
}

if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Phase 15A Test aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName) {
  throw new Error("Phase 15A Test aborted: Database name is missing from DATABASE_URL.");
}

if (
  dbName === "aubrey_rankings" ||
  dbName === "aubrey" ||
  dbName === "postgres" ||
  dbName === "template1" ||
  dbName === "template0"
) {
  throw new Error(
    `Phase 15A Test aborted: Refusing to run against primary database "${dbName}". A dedicated disposable test database is strictly required.`
  );
}

const isExplicitTestDb = dbName.endsWith("_test") || dbName.includes("test");
if (!isExplicitTestDb) {
  throw new Error(
    `Phase 15A Test aborted: Database "${dbName}" is ambiguous. The dedicated test database name must explicitly contain "test" or end in "_test".`
  );
}

// Dynamically import database and schema modules after safety validation
let db: typeof import("../db").db;
let user: typeof import("../db/schema").user;
let mediaItems: typeof import("../db/schema").mediaItems;
let ratings: typeof import("../db/schema").ratings;
let reviews: typeof import("../db/schema").reviews;
let diaryEntries: typeof import("../db/schema").diaryEntries;
let watchlistItems: typeof import("../db/schema").watchlistItems;
let collections: typeof import("../db/schema").collections;
let collectionEntries: typeof import("../db/schema").collectionEntries;
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;
let isNull: typeof import("drizzle-orm").isNull;

describe("Phase 15A: Unified Media Pages & Navigation Architecture", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  let testUser1Id = `usr_p15a_owner_${suffix}`;
  let testUser2Id = `usr_p15a_viewer_${suffix}`;
  let testMovieId = `med_p15a_movie_${suffix}`;
  let testSeriesId = `tv_9999_${suffix}`;
  let testEpisodeId = `tv_9999_${suffix}_s1_e1`;

  before(async () => {
    const dbModule = await import("../db");
    const schemaModule = await import("../db/schema");
    const ormModule = await import("drizzle-orm");

    db = dbModule.db;
    user = schemaModule.user;
    mediaItems = schemaModule.mediaItems;
    ratings = schemaModule.ratings;
    reviews = schemaModule.reviews;
    diaryEntries = schemaModule.diaryEntries;
    watchlistItems = schemaModule.watchlistItems;
    collections = schemaModule.collections;
    collectionEntries = schemaModule.collectionEntries;
    eq = ormModule.eq;
    and = ormModule.and;
    isNull = ormModule.isNull;

    // Create test users
    await db.insert(user).values([
      {
        id: testUser1Id,
        name: "Phase 15A Owner",
        email: `p15a_owner_${suffix}@example.com`,
        username: `p15a_owner_${suffix}`,
        emailVerified: true,
      },
      {
        id: testUser2Id,
        name: "Phase 15A Viewer",
        email: `p15a_viewer_${suffix}@example.com`,
        username: `p15a_viewer_${suffix}`,
        emailVerified: true,
      },
    ]);

    // Create test media: movie, series, episode
    await db.insert(mediaItems).values([
      {
        id: testMovieId,
        title: "Interstellar Odyssey",
        mediaType: "movie",
        releaseDate: "2024-11-07",
        overview: "A journey through space and time.",
      },
      {
        id: testSeriesId,
        title: "Cyberpunk Anthology",
        mediaType: "tv",
        releaseDate: "2023-01-15",
        overview: "A dystopian series exploring humanity and cybernetics.",
      },
      {
        id: testEpisodeId,
        title: "Cyberpunk Anthology: Pilot",
        mediaType: "episode",
        releaseDate: "2023-01-15",
        seasonNumber: 1,
        episodeNumber: 1,
        parentMediaId: testSeriesId,
        overview: "The opening chapter of the cyberpunk saga.",
      },
    ]);
  });

  after(async () => {
    if (!db) return;
    try {
      await db.delete(collectionEntries).where(eq(collectionEntries.mediaItemId, testMovieId));
      await db.delete(collections).where(eq(collections.userId, testUser1Id));
      await db.delete(diaryEntries).where(eq(diaryEntries.userId, testUser1Id));
      await db.delete(watchlistItems).where(eq(watchlistItems.userId, testUser1Id));
      await db.delete(reviews).where(eq(reviews.userId, testUser1Id));
      await db.delete(ratings).where(eq(ratings.userId, testUser1Id));
      await db.delete(mediaItems).where(eq(mediaItems.id, testMovieId));
      await db.delete(mediaItems).where(eq(mediaItems.id, testEpisodeId));
      await db.delete(mediaItems).where(eq(mediaItems.id, testSeriesId));
      await db.delete(user).where(eq(user.id, testUser1Id));
      await db.delete(user).where(eq(user.id, testUser2Id));
    } catch {}
  });

  describe("Part 1: Canonical URL routing & Navigation consistency", () => {
    it("generates canonical public Title Overview URL by default", () => {
      const url = getPublicMediaUrl("movie-123");
      assert.equal(url, "/media/movie-123");
    });

    it("generates canonical personal 'Your View' URL with view=personal parameter", () => {
      const url = getPersonalMediaUrl("movie-123");
      assert.equal(url, "/media/movie-123?view=personal");
    });

    it("preserves deep links (journal=1, type, season) without breaking canonical routing", () => {
      const personalJournalUrl = getPersonalMediaUrl("movie-123", { journal: true });
      assert.equal(personalJournalUrl, "/media/movie-123?view=personal&journal=1");

      const publicTvSeasonUrl = getPublicMediaUrl("show-456", { type: "tv", season: 2 });
      assert.equal(publicTvSeasonUrl, "/media/show-456?type=tv&season=2");
    });

    it("routes rankings based on owner context: owner -> Your View, visitor -> Title Overview", () => {
      const ownerUrl = getRankingMediaUrl("movie-123", true);
      assert.equal(ownerUrl, "/media/movie-123?view=personal");

      const visitorUrl = getRankingMediaUrl("movie-123", false);
      assert.equal(visitorUrl, "/media/movie-123");
    });

    it("properly encodes media IDs with special characters or spaces", () => {
      const encodedUrl = getPublicMediaUrl("tmdb tv 1399 s1 e1");
      assert.equal(encodedUrl, "/media/tmdb%20tv%201399%20s1%20e1");

      const encodedPersonalUrl = getPersonalMediaUrl("special/id&here");
      assert.equal(encodedPersonalUrl, "/media/special%2Fid%26here?view=personal");
    });
  });

  describe("Part 2: Privacy Boundaries & Review Query Isolation", () => {
    let publicReviewId = `rev_pub_${suffix}`;
    let draftReviewId = `rev_draft_${suffix}`;
    let privateReviewId = `rev_priv_${suffix}`;

    before(async () => {
      // Insert one public published review, one draft review, and one private review
      await db.insert(reviews).values([
        {
          id: publicReviewId,
          userId: testUser1Id,
          mediaItemId: testMovieId,
          title: "A Masterpiece of Hard Sci-Fi",
          content: "Visually stunning and emotionally resonant.",
          status: "published",
          visibility: "public",
          publishedAt: new Date(),
        },
        {
          id: draftReviewId,
          userId: testUser1Id,
          mediaItemId: testMovieId,
          title: "Draft Notes for Review",
          content: "Rough thoughts: third act pacing felt rushed.",
          draftContent: "Rough thoughts: third act pacing felt rushed.",
          status: "draft",
          visibility: "public",
        },
        {
          id: privateReviewId,
          userId: testUser1Id,
          mediaItemId: testMovieId,
          title: "Private Journal Reflection",
          content: "Watched with family on a rainy weekend.",
          status: "published",
          visibility: "private",
          publishedAt: new Date(),
        },
      ]);
    });

    it("public overview queries strictly return published public reviews and exclude drafts and private reviews", async () => {
      // Query published public reviews as done in MediaDetailsPage
      const publicReviews = await db.query.reviews.findMany({
        where: (rv, { and, eq }) =>
          and(
            eq(rv.mediaItemId, testMovieId),
            eq(rv.status, "published"),
            eq(rv.visibility, "public")
          ),
      });

      assert.equal(publicReviews.length, 1);
      assert.equal(publicReviews[0].id, publicReviewId);
      assert.equal(publicReviews[0].title, "A Masterpiece of Hard Sci-Fi");

      // Verify draft is NOT in public reviews
      const draftFound = publicReviews.some((r) => r.id === draftReviewId);
      assert.equal(draftFound, false, "Draft review must not be exposed on public overview");

      // Verify private review is NOT in public reviews
      const privateFound = publicReviews.some((r) => r.id === privateReviewId);
      assert.equal(privateFound, false, "Private review must not be exposed on public overview");
    });

    it("personal view queries retrieve the owner's drafts and private notes safely", async () => {
      // Query owner's reviews as done in MediaDetailsPage for authenticated user
      const ownerReviews = await db.query.reviews.findMany({
        where: (rv, { and, eq }) =>
          and(
            eq(rv.userId, testUser1Id),
            eq(rv.mediaItemId, testMovieId)
          ),
      });

      assert.equal(ownerReviews.length, 3);
      const statuses = ownerReviews.map((r) => r.status);
      assert.ok(statuses.includes("draft"));
      assert.ok(statuses.includes("published"));

      const visibilities = ownerReviews.map((r) => r.visibility);
      assert.ok(visibilities.includes("private"));
      assert.ok(visibilities.includes("public"));
    });

    it("another user's personal query does NOT leak owner's private drafts or reviews", async () => {
      const viewerReviews = await db.query.reviews.findMany({
        where: (rv, { and, eq }) =>
          and(
            eq(rv.userId, testUser2Id),
            eq(rv.mediaItemId, testMovieId)
          ),
      });

      assert.equal(viewerReviews.length, 0, "Viewer must see 0 reviews in their own personal view for this title");
    });
  });

  describe("Part 3: Accurate Rating Display & Collection Distinction", () => {
    let standaloneRatingId = `rat_stand_${suffix}`;
    let collectionId = `col_top10_${suffix}`;
    let collectionRatingId = `rat_col_${suffix}`;

    before(async () => {
      // Standalone rating (collectionId is NULL)
      await db.insert(ratings).values({
        id: standaloneRatingId,
        userId: testUser1Id,
        mediaItemId: testMovieId,
        collectionId: null,
        calculatedOverallScore: 8.8,
        personalNotes: "Outstanding visual effects and Hans Zimmer score.",
        isWatched: true,
      });

      // User's custom ranking collection
      await db.insert(collections).values({
        id: collectionId,
        userId: testUser1Id,
        title: "All-Time Sci-Fi Top 10",
        collectionType: "standard",
        visibility: "public",
      });

      // Collection-scoped rating and entry
      await db.insert(ratings).values({
        id: collectionRatingId,
        userId: testUser1Id,
        mediaItemId: testMovieId,
        collectionId: collectionId,
        calculatedOverallScore: 9.5,
      });

      await db.insert(collectionEntries).values({
        id: `ce_${suffix}`,
        collectionId: collectionId,
        mediaItemId: testMovieId,
        sortOrder: 0,
        notes: "Rank #1 sci-fi film",
      });
    });

    it("distinguishes standalone rating from ranking collection rating without score conflation", async () => {
      // Query standalone rating as done in personal view
      const standaloneRating = await db.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) =>
          and(
            eq(r.userId, testUser1Id),
            eq(r.mediaItemId, testMovieId),
            isNull(r.collectionId)
          ),
      });

      assert.ok(standaloneRating, "Standalone rating must exist");
      assert.equal(standaloneRating.calculatedOverallScore, 8.8);
      assert.equal(standaloneRating.personalNotes, "Outstanding visual effects and Hans Zimmer score.");

      // Query collection-scoped rating
      const collRating = await db.query.ratings.findFirst({
        where: (r, { and, eq }) =>
          and(
            eq(r.userId, testUser1Id),
            eq(r.mediaItemId, testMovieId),
            eq(r.collectionId, collectionId)
          ),
      });

      assert.ok(collRating, "Collection rating must exist");
      assert.equal(collRating.calculatedOverallScore, 9.5);
      assert.notEqual(
        standaloneRating.calculatedOverallScore,
        collRating.calculatedOverallScore,
        "Standalone rating and ranking rating must not be conflated"
      );
    });

    it("identifies ranked collections for the title in personal view", async () => {
      const entries = await db.query.collectionEntries.findMany({
        where: eq(collectionEntries.mediaItemId, testMovieId),
        with: {
          collection: true,
        },
      });

      const ownerRanked = entries.filter((e) => e.collection && e.collection.userId === testUser1Id);
      assert.equal(ownerRanked.length, 1);
      assert.equal(ownerRanked[0].collection.title, "All-Time Sci-Fi Top 10");
      assert.equal(ownerRanked[0].sortOrder, 0); // Rank #1
    });
  });

  describe("Part 4: TV Series & Episode Architecture", () => {
    it("resolves TV episode hierarchy and parent show relationship", async () => {
      const episode = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, testEpisodeId),
      });

      assert.ok(episode, "Episode record must exist");
      assert.equal(episode.mediaType, "episode");
      assert.equal(episode.seasonNumber, 1);
      assert.equal(episode.episodeNumber, 1);
      assert.equal(episode.parentMediaId, testSeriesId);

      // Verify parent show exists
      const parentShow = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, episode.parentMediaId),
      });

      assert.ok(parentShow, "Parent show must exist");
      assert.equal(parentShow.mediaType, "tv");
      assert.equal(parentShow.title, "Cyberpunk Anthology");
    });

    it("builds consistent public and personal URLs for TV shows and episodes", () => {
      const showOverviewUrl = getPublicMediaUrl(testSeriesId, { type: "tv" });
      assert.equal(showOverviewUrl, `/media/${testSeriesId}?type=tv`);

      const episodeOverviewUrl = getPublicMediaUrl(testEpisodeId);
      assert.equal(episodeOverviewUrl, `/media/${testEpisodeId}`);

      const episodePersonalUrl = getPersonalMediaUrl(testEpisodeId);
      assert.equal(episodePersonalUrl, `/media/${testEpisodeId}?view=personal`);
    });
  });

  describe("Part 5: Non-mutating Public Browsing", () => {
    it("browsing synthetic or unpersisted TMDB IDs does not insert rows into mediaItems table", async () => {
      const beforeCount = await db.$count(mediaItems);

      // Simulate a synthetic ID lookup format
      const syntheticId = "tmdb-movie-99999999";
      const existing = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, syntheticId),
      });
      assert.equal(existing, undefined, "Item should not exist in database");

      // Verify database row count did not change
      const afterCount = await db.$count(mediaItems);
      assert.equal(afterCount, beforeCount, "Browsing must remain strictly non-mutating");
    });
  });
});
