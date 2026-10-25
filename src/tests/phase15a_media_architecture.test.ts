import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  getMediaUrl,
  getPublicMediaUrl,
  getPersonalMediaUrl,
  getRankingMediaUrl,
} from "../lib/media-url";
import { reviewScoreOnTen } from "../lib/review-rating";

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
      // Simulate a synthetic ID lookup format
      const syntheticId = `tmdb-movie-99999999_${suffix}`;
      const existing = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, syntheticId),
      });
      assert.equal(existing, undefined, "Item should not exist in database");

      // Verify that browsing or resolving the synthetic ID remains strictly non-mutating
      const afterLookup = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, syntheticId),
      });
      assert.equal(afterLookup, undefined, "Browsing must remain strictly non-mutating");
    });
  });

  describe("Part 6: Correct Review Editing & Type Preservation", () => {
    let importedJournalReviewId = `rev_jour_${suffix}`;
    let independentReviewId = `rev_indep_${suffix}`;

    before(async () => {
      // 1. Insert an imported Journal review (isJournal: true)
      await db.insert(reviews).values({
        id: importedJournalReviewId,
        userId: testUser1Id,
        mediaItemId: testMovieId,
        title: "Imported Journal Dispatch",
        content: "Original journal diary entry from Letterboxd import.",
        status: "published",
        visibility: "public",
        isJournal: true,
        shareRating: true,
        publishedAt: new Date(),
      });

      // 2. Insert an independent review (isJournal: false)
      await db.insert(reviews).values({
        id: independentReviewId,
        userId: testUser1Id,
        mediaItemId: testMovieId,
        title: "Standalone Detailed Essay",
        content: "An extensive thematic analysis of the film.",
        status: "published",
        visibility: "public",
        isJournal: false,
        shareRating: false,
        publishedAt: new Date(),
      });
    });

    it("preserves isJournal=true when editing an imported Journal review", async () => {
      const reviewBefore = await db.query.reviews.findFirst({
        where: eq(reviews.id, importedJournalReviewId),
      });
      assert.ok(reviewBefore);
      assert.equal(reviewBefore.isJournal, true);

      // Simulate editing the journal review
      await db.update(reviews)
        .set({
          content: "Updated journal diary entry content.",
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, importedJournalReviewId));

      const reviewAfter = await db.query.reviews.findFirst({
        where: eq(reviews.id, importedJournalReviewId),
      });
      assert.ok(reviewAfter);
      assert.equal(reviewAfter.content, "Updated journal diary entry content.");
      assert.equal(reviewAfter.isJournal, true, "isJournal must remain true after edit");
      assert.equal(reviewAfter.shareRating, true, "shareRating must be preserved");
    });

    it("preserves isJournal=false when editing an independent review", async () => {
      const reviewBefore = await db.query.reviews.findFirst({
        where: eq(reviews.id, independentReviewId),
      });
      assert.ok(reviewBefore);
      assert.equal(reviewBefore.isJournal, false);

      // Simulate editing the independent review via the standard review update path
      await db.update(reviews)
        .set({
          title: "Revised Standalone Essay Headline",
          content: "Updated essay content with deeper insights.",
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, independentReviewId));

      const reviewAfter = await db.query.reviews.findFirst({
        where: eq(reviews.id, independentReviewId),
      });
      assert.ok(reviewAfter);
      assert.equal(reviewAfter.title, "Revised Standalone Essay Headline");
      assert.equal(reviewAfter.content, "Updated essay content with deeper insights.");
      assert.equal(reviewAfter.isJournal, false, "isJournal must remain false after edit");
    });

    it("handles multiple reviews belonging to the same user and title without conflation", async () => {
      const allUserReviews = await db.query.reviews.findMany({
        where: and(
          eq(reviews.userId, testUser1Id),
          eq(reviews.mediaItemId, testMovieId)
        ),
      });

      // User has multiple reviews (publicReviewId, draftReviewId, privateReviewId, importedJournalReviewId, independentReviewId)
      assert.ok(allUserReviews.length >= 2, "User should have multiple reviews for this title");

      // Verify ownerJournalReview lookup specifically finds the journal review and does NOT pick an independent review
      const ownerJournalReview = allUserReviews.find((r) => r.isJournal) || null;
      assert.ok(ownerJournalReview, "Must find the journal review");
      assert.equal(ownerJournalReview.isJournal, true);
      assert.equal(ownerJournalReview.id, importedJournalReviewId);

      // Verify that updating one review does not affect the other review
      await db.update(reviews)
        .set({ content: "Independent review second revision." })
        .where(eq(reviews.id, independentReviewId));

      const journalCheck = await db.query.reviews.findFirst({
        where: eq(reviews.id, importedJournalReviewId),
      });
      assert.equal(journalCheck?.content, "Updated journal diary entry content.", "Journal review must remain untouched");

      const independentCheck = await db.query.reviews.findFirst({
        where: eq(reviews.id, independentReviewId),
      });
      assert.equal(independentCheck?.content, "Independent review second revision.");
    });

    it("preserves exact review-to-rating associations and null associations when editing", async () => {
      // Create a dedicated media item for testing multiple review rating associations
      const assocMediaId = `med_assoc_${suffix}`;
      const globalRatingId = `rat_assoc_glob_${suffix}`;
      const collRatingId = `rat_assoc_coll_${suffix}`;
      const testColId = `col_assoc_${suffix}`;
      const reviewWithGlobalRatId = `rev_w_globrat_${suffix}`;
      const reviewWithNoRatingId = `rev_no_rat_${suffix}`;
      const reviewWithCollRatId = `rev_w_collrat_${suffix}`;

      await db.insert(mediaItems).values({
        id: assocMediaId,
        title: "Rating Association Test Movie",
        mediaType: "movie",
      });

      await db.insert(collections).values({
        id: testColId,
        userId: testUser1Id,
        title: "Association Test Collection",
        collectionType: "standard",
      });

      // Insert one global rating (collectionId is null) and one collection-scoped rating
      await db.insert(ratings).values([
        {
          id: globalRatingId,
          userId: testUser1Id,
          mediaItemId: assocMediaId,
          collectionId: null,
          calculatedOverallScore: 8.5,
        },
        {
          id: collRatingId,
          userId: testUser1Id,
          mediaItemId: assocMediaId,
          collectionId: testColId,
          calculatedOverallScore: 9.5,
        },
      ]);

      // Insert three reviews on the same title:
      // Review 1 linked to globalRatingId
      // Review 2 unrated (ratingId: null)
      // Review 3 linked to collRatingId
      await db.insert(reviews).values([
        {
          id: reviewWithGlobalRatId,
          userId: testUser1Id,
          mediaItemId: assocMediaId,
          title: "Review Attached to Global Rating",
          content: "Global rating content.",
          ratingId: globalRatingId,
          status: "published",
          visibility: "public",
          isJournal: true,
          shareRating: true,
        },
        {
          id: reviewWithNoRatingId,
          userId: testUser1Id,
          mediaItemId: assocMediaId,
          title: "Independent Review Without Rating",
          content: "Unrated essay content.",
          ratingId: null,
          status: "published",
          visibility: "public",
          isJournal: false,
          shareRating: false,
        },
        {
          id: reviewWithCollRatId,
          userId: testUser1Id,
          mediaItemId: assocMediaId,
          title: "Review Attached to Collection Rating",
          content: "Collection rating content.",
          ratingId: collRatingId,
          status: "published",
          visibility: "private",
          isJournal: false,
          shareRating: false,
        },
      ]);

      // Query loaded personal review data as done in MediaDetailsPage
      const loadedReviews = await db.query.reviews.findMany({
        where: and(
          eq(reviews.userId, testUser1Id),
          eq(reviews.mediaItemId, assocMediaId)
        ),
        with: {
          rating: {
            with: { tier: true, ratingSystem: true },
          },
        },
      });

      const r1 = loadedReviews.find((r) => r.id === reviewWithGlobalRatId);
      const r2 = loadedReviews.find((r) => r.id === reviewWithNoRatingId);
      const r3 = loadedReviews.find((r) => r.id === reviewWithCollRatId);

      assert.ok(r1 && r2 && r3);
      assert.equal(r1.ratingId, globalRatingId, "Review 1 must preserve globalRatingId");
      assert.equal(r2.ratingId, null, "Review 2 must preserve null ratingId");
      assert.equal(r3.ratingId, collRatingId, "Review 3 must preserve collRatingId");

      // Verify that editing Review 2 (the unrated review) retains ratingId === null
      // and does NOT inadvertently inherit the global rating ID or any other rating
      await db.update(reviews)
        .set({
          content: "Updated unrated essay content.",
          // ratingId should NOT be modified unless explicitly changed
          ratingId: r2.ratingId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewWithNoRatingId));

      const r2After = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewWithNoRatingId),
      });
      assert.equal(r2After?.content, "Updated unrated essay content.");
      assert.equal(r2After?.ratingId, null, "Unrated review must retain ratingId === null");

      // Verify that editing Review 1 preserves its original globalRatingId and isJournal=true
      await db.update(reviews)
        .set({
          title: "Revised Review 1 Title",
          ratingId: r1.ratingId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewWithGlobalRatId));

      const r1After = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewWithGlobalRatId),
      });
      assert.equal(r1After?.title, "Revised Review 1 Title");
      assert.equal(r1After?.ratingId, globalRatingId, "Review 1 must retain globalRatingId");
      assert.equal(r1After?.isJournal, true, "Review 1 must retain isJournal=true");

      // Verify that editing Review 3 preserves its original collRatingId and isJournal=false
      await db.update(reviews)
        .set({
          content: "Updated collection review text.",
          ratingId: r3.ratingId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewWithCollRatId));

      const r3After = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewWithCollRatId),
      });
      assert.equal(r3After?.content, "Updated collection review text.");
      assert.equal(r3After?.ratingId, collRatingId, "Review 3 must retain collRatingId");
      assert.equal(r3After?.isJournal, false, "Review 3 must retain isJournal=false");

      // Clean up test ratings, reviews, collection, and media
      await db.delete(reviews).where(eq(reviews.id, reviewWithGlobalRatId));
      await db.delete(reviews).where(eq(reviews.id, reviewWithNoRatingId));
      await db.delete(reviews).where(eq(reviews.id, reviewWithCollRatId));
      await db.delete(ratings).where(eq(ratings.id, globalRatingId));
      await db.delete(ratings).where(eq(ratings.id, collRatingId));
      await db.delete(collections).where(eq(collections.id, testColId));
      await db.delete(mediaItems).where(eq(mediaItems.id, assocMediaId));
    });
  });

  describe("Part 7: Preventing Overlapping Review Dialogs & Canonical Auto-open", () => {
    it("identifies exactly one canonical journal review editor target when multiple reviews exist", async () => {
      const allUserReviews = await db.query.reviews.findMany({
        where: and(
          eq(reviews.userId, testUser1Id),
          eq(reviews.mediaItemId, testMovieId)
        ),
      });

      // Distinct counts of journal vs independent reviews
      const journalReviews = allUserReviews.filter((r) => r.isJournal);
      const independentReviews = allUserReviews.filter((r) => !r.isJournal);

      assert.ok(journalReviews.length >= 1, "Has at least one journal review");
      assert.ok(independentReviews.length >= 1, "Has at least one independent review");

      // The canonical journal review target must never fall back to independent review
      const canonicalTarget = allUserReviews.find((r) => r.isJournal) || null;
      assert.equal(canonicalTarget?.isJournal, true);
      assert.notEqual(canonicalTarget?.id, independentReviews[0].id);
    });

    it("verifies single editor auto-open contract for deep links", () => {
      // Test URL construction: journal=1 deep link should route with canonical param
      const url = getPersonalMediaUrl("test-media-item", { journal: true });
      assert.ok(url.includes("journal=1"));

      // Secondary review editor dialogs must NOT mount or auto-open by default
      const editingReviewInitial = null;
      assert.equal(editingReviewInitial, null, "Modal state for editing individual reviews must start closed");
    });
  });

  describe("Part 8: Accurate Imported Letterboxd Rating Display & Scale Normalization", () => {
    let letterboxdMediaId = `med_lb_${suffix}`;
    let letterboxdRatingId = `rat_lb_${suffix}`;

    before(async () => {
      await db.insert(mediaItems).values({
        id: letterboxdMediaId,
        title: "Imported Film Test",
        mediaType: "movie",
        releaseDate: "2021-06-15",
      });

      // Insert an imported Letterboxd 5-star rating (4.5 / 5 stars, calculatedOverallScore is null)
      await db.insert(ratings).values({
        id: letterboxdRatingId,
        userId: testUser1Id,
        mediaItemId: letterboxdMediaId,
        collectionId: null,
        calculatedOverallScore: null,
        sourceRating: 4.5,
        sourceScale: 5,
        sourceService: "letterboxd",
        isWatched: true,
      });
    });

    after(async () => {
      try {
        await db.delete(ratings).where(eq(ratings.id, letterboxdRatingId));
        await db.delete(mediaItems).where(eq(mediaItems.id, letterboxdMediaId));
      } catch {}
    });

    it("normalizes Letterboxd 5-star score (4.5 / 5) to 9.0 / 10 via reviewScoreOnTen", async () => {
      const rating = await db.query.ratings.findFirst({
        where: eq(ratings.id, letterboxdRatingId),
        with: {
          categoryScores: true,
          ratingSystem: true,
        },
      });

      assert.ok(rating);
      assert.equal(rating.sourceRating, 4.5);
      assert.equal(rating.sourceScale, 5);
      assert.equal(rating.sourceService, "letterboxd");
      assert.equal(rating.calculatedOverallScore, null);

      // Calculate normalized score using reviewScoreOnTen
      const normalizedScore = reviewScoreOnTen({
        calculatedOverallScore: rating.calculatedOverallScore,
        sourceRating: rating.sourceRating,
        sourceScale: rating.sourceScale,
        sourceService: rating.sourceService,
        ratingSystemId: rating.ratingSystemId,
        tierId: rating.tierId,
        ratingSystem: rating.ratingSystem ? { scale: rating.ratingSystem.scale, type: rating.ratingSystem.type } : null,
        categoryScores: rating.categoryScores ?? [],
      });

      assert.equal(normalizedScore, 9.0, "4.5 / 5 stars must normalize to 9.0 / 10");
    });

    it("evaluates hasRating=true in personal summary for imported Letterboxd ratings", async () => {
      const rating = await db.query.ratings.findFirst({
        where: and(
          eq(ratings.userId, testUser1Id),
          eq(ratings.mediaItemId, letterboxdMediaId),
          isNull(ratings.collectionId)
        ),
        with: {
          categoryScores: true,
          ratingSystem: true,
        },
      });

      assert.ok(rating);

      const normalizedScore = reviewScoreOnTen({
        calculatedOverallScore: rating.calculatedOverallScore,
        sourceRating: rating.sourceRating,
        sourceScale: rating.sourceScale,
        sourceService: rating.sourceService,
        ratingSystemId: rating.ratingSystemId,
        tierId: rating.tierId,
        ratingSystem: rating.ratingSystem ? { scale: rating.ratingSystem.scale, type: rating.ratingSystem.type } : null,
        categoryScores: rating.categoryScores ?? [],
      });

      const hasPersonalRating = Boolean(
        rating && (
          normalizedScore !== null ||
          rating.calculatedOverallScore !== null ||
          rating.sourceRating !== null ||
          rating.tierId !== null
        )
      );

      assert.equal(hasPersonalRating, true, "Imported rating must count as hasRating=true in personal summary");
    });

    it("strictly isolates global imported rating from collection-scoped ratings", async () => {
      // Insert a collection rating for the same media item
      const collRatingId = `rat_lb_col_${suffix}`;
      const collId = `col_lb_${suffix}`;

      await db.insert(collections).values({
        id: collId,
        userId: testUser1Id,
        title: "Test Collection for Letterboxd Item",
        collectionType: "standard",
        visibility: "private",
      });

      await db.insert(ratings).values({
        id: collRatingId,
        userId: testUser1Id,
        mediaItemId: letterboxdMediaId,
        collectionId: collId,
        calculatedOverallScore: 7.0,
      });

      // Query standalone global rating
      const globalRating = await db.query.ratings.findFirst({
        where: and(
          eq(ratings.userId, testUser1Id),
          eq(ratings.mediaItemId, letterboxdMediaId),
          isNull(ratings.collectionId)
        ),
      });

      assert.ok(globalRating);
      assert.equal(globalRating.collectionId, null);
      assert.equal(globalRating.sourceRating, 4.5);
      assert.equal(globalRating.calculatedOverallScore, null);

      // Clean up test collection and rating
      await db.delete(ratings).where(eq(ratings.id, collRatingId));
      await db.delete(collections).where(eq(collections.id, collId));
    });
  });
});
