import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  communityAverage,
  resolveReviewScoreOnTen,
  reviewScoreOnTen,
  type CommunityRatingCandidate,
} from "../lib/review-rating";
import { getCommunityAverage } from "../lib/community-rating";
import {
  getPublicMediaUrl,
  getPersonalMediaUrl,
  sanitizeInternalReturnUrl,
  getContextualBackInfo,
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
    "Phase 15C Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Phase 15C Test aborted: DATABASE_URL is required.");
}

const parsedUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Phase 15C Test aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName.includes("test")) {
  throw new Error(
    `Phase 15C Test aborted: DATABASE_URL must point to a test database (containing 'test' in name), got: ${dbName}`
  );
}

describe("Phase 15C: Public Title Overview, Community Ratings & Ownership", () => {
  let db: any;
  let pool: any;
  let schema: any;
  let eq: any;
  let and: any;

  const suffix = `${process.pid}_${Date.now()}`;
  const user1Id = `usr_p15c_u1_${suffix}`;
  const user2Id = `usr_p15c_u2_${suffix}`;
  const user3Id = `usr_p15c_u3_${suffix}`;
  const blockedUserId = `usr_p15c_blocked_${suffix}`;
  const media1Id = `med_p15c_film_${suffix}`;
  const media2Id = `med_p15c_unrated_${suffix}`;
  const col1Id = `col_p15c_public_${suffix}`;
  const col2Id = `col_p15c_private_${suffix}`;
  const col3Id = `col_p15c_unlisted_${suffix}`;

  before(async () => {
    const dbModule = await import("../db");
    const schemaModule = await import("../db/schema");
    const ormModule = await import("drizzle-orm");

    db = dbModule.db;
    pool = dbModule.pool;
    schema = schemaModule;
    eq = ormModule.eq;
    and = ormModule.and;

    // Seed test users
    await db.insert(schema.user).values([
      { id: user1Id, name: "Critic One", username: `critic1_${suffix}`, email: `${user1Id}@test.local` },
      { id: user2Id, name: "Critic Two", username: `critic2_${suffix}`, email: `${user2Id}@test.local` },
      { id: user3Id, name: "Critic Three", username: `critic3_${suffix}`, email: `${user3Id}@test.local` },
      { id: blockedUserId, name: "Blocked User", username: `blocked_${suffix}`, email: `${blockedUserId}@test.local` },
    ]);

    // Seed test media
    await db.insert(schema.mediaItems).values([
      { id: media1Id, title: "Grand Budapest Hotel", mediaType: "movie", releaseDate: "2014-03-28" },
      { id: media2Id, title: "Unrated Film", mediaType: "movie", releaseDate: "2020-01-01" },
    ]);

    // Seed test collections
    await db.insert(schema.collections).values([
      {
        id: col1Id,
        userId: user1Id,
        title: "Wes Anderson Ranked",
        collectionType: "movie_franchise",
        visibility: "public",
        isPublic: true,
        isRanked: true,
      },
      {
        id: col2Id,
        userId: user1Id,
        title: "Secret Favorites",
        collectionType: "custom",
        visibility: "private",
        isPublic: false,
        isRanked: true,
      },
      {
        id: col3Id,
        userId: user2Id,
        title: "Unlisted Viewing List",
        collectionType: "custom",
        visibility: "unlisted",
        isPublic: false,
        isRanked: false,
      },
    ]);

    // Seed collection entries
    await db.insert(schema.collectionEntries).values([
      { id: `ce_1_${suffix}`, collectionId: col1Id, mediaItemId: media1Id, sortOrder: 0, notes: "Top pick" },
      { id: `ce_2_${suffix}`, collectionId: col2Id, mediaItemId: media1Id, sortOrder: 0, notes: "Private note" },
      { id: `ce_3_${suffix}`, collectionId: col3Id, mediaItemId: media1Id, sortOrder: 0, notes: "Unlisted entry" },
    ]);
  });

  after(async () => {
    try {
      await db.delete(schema.collectionEntries).where(eq(schema.collectionEntries.mediaItemId, media1Id));
      await db.delete(schema.collections).where(eq(schema.collections.userId, user1Id));
      await db.delete(schema.collections).where(eq(schema.collections.userId, user2Id));
      await db.delete(schema.reviews).where(eq(schema.reviews.mediaItemId, media1Id));
      await db.delete(schema.reviews).where(eq(schema.reviews.mediaItemId, media2Id));
      await db.delete(schema.ratings).where(eq(schema.ratings.mediaItemId, media1Id));
      await db.delete(schema.mediaNotes).where(eq(schema.mediaNotes.mediaItemId, media1Id));
      await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, media1Id));
      await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, media2Id));
      await db.delete(schema.user).where(eq(schema.user.id, user1Id));
      await db.delete(schema.user).where(eq(schema.user.id, user2Id));
      await db.delete(schema.user).where(eq(schema.user.id, user3Id));
      await db.delete(schema.user).where(eq(schema.user.id, blockedUserId));
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Community Average Calculation & Multiple Scales
  // ---------------------------------------------------------------------------
  it("normalizes diverse authentic source scales including Letterboxd half-stars and 100-point rubrics", () => {
    // 10-point scale direct score: 8.0 -> 8.0
    const cand1: CommunityRatingCandidate = {
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      ratingValue: 8.0,
      rating: null,
    };
    assert.equal(resolveReviewScoreOnTen(cand1), 8.0);

    // Letterboxd 5-star half-star score: 4.5 / 5 -> 9.0
    const cand2: CommunityRatingCandidate = {
      userId: user2Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      sourceRating: 4.5,
      sourceScale: 5,
      sourceService: "letterboxd",
      rating: null,
    };
    assert.equal(resolveReviewScoreOnTen(cand2), 9.0);

    // Letterboxd 5-star score: 3.5 / 5 -> 7.0
    const cand3: CommunityRatingCandidate = {
      userId: user3Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      sourceRating: 3.5,
      sourceScale: 5,
      sourceService: "letterboxd",
      rating: null,
    };
    assert.equal(resolveReviewScoreOnTen(cand3), 7.0);

    // Linked numerical rubric rating on 100-point scale: 75 / 100 -> 7.5
    const cand4: CommunityRatingCandidate = {
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: true,
      shareRating: true,
      rating: {
        userId: user1Id,
        mediaItemId: media1Id,
        collectionId: null,
        tierId: null,
        sourceRating: null,
        sourceService: null,
        calculatedOverallScore: 75,
        ratingSystemId: "sys_100",
        ratingSystem: { scale: 100, type: "numerical" },
      },
    };
    assert.equal(resolveReviewScoreOnTen(cand4), 7.5);

    // Average across cand1 (8.0), cand2 (9.0), cand3 (7.0): total = 24.0, count = 3, avg = 8.0
    const result = communityAverage(media1Id, [cand1, cand2, cand3]);
    assert.ok(result);
    assert.equal(result.count, 3);
    assert.equal(result.average, 8.0);
    assert.equal(result.starsAverage, 4.0);
    assert.equal(result.distribution.buckets.length, 5);
  });

  // ---------------------------------------------------------------------------
  // 2. Multiple Public Rated Reviews from the SAME Account Count Independently
  // ---------------------------------------------------------------------------
  it("counts multiple public rated reviews from the same account independently without arbitrary deduplication", () => {
    // User 1's initial review: 6.0
    const review1: CommunityRatingCandidate = {
      id: "rev_initial",
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      ratingValue: 6.0,
      rating: null,
    };

    // User 1's rewatch review years later: 10.0
    const review2: CommunityRatingCandidate = {
      id: "rev_rewatch",
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      ratingValue: 10.0,
      rating: null,
    };

    // Both are from user1Id; both must count!
    const result = communityAverage(media1Id, [review1, review2]);
    assert.ok(result);
    assert.equal(result.count, 2, "Both reviews from the same account must count independently");
    assert.equal(result.average, 8.0, "Average must accurately reflect (6.0 + 10.0) / 2 = 8.0");
    assert.equal(result.starsAverage, 4.0);

    // Distribution should show 1 rating in 3-star (score 6) and 1 rating in 5-star (score 10)
    const counts = result.distribution.countsByStar;
    assert.equal(counts[5], 1);
    assert.equal(counts[3], 1);
    assert.equal(counts[4], 0);
  });

  // ---------------------------------------------------------------------------
  // 3. Privacy Exclusions & Explicit Authorization
  // ---------------------------------------------------------------------------
  it("strictly excludes drafts, unpublished reviews, private reviews, and unshared journal ratings", () => {
    const candidates: CommunityRatingCandidate[] = [
      // Valid public rating
      {
        userId: user1Id,
        mediaItemId: media1Id,
        status: "published",
        visibility: "public",
        isJournal: false,
        shareRating: true,
        ratingValue: 8.0,
        rating: null,
      },
      // Draft review
      {
        userId: user2Id,
        mediaItemId: media1Id,
        status: "draft",
        visibility: "public",
        isJournal: false,
        shareRating: true,
        ratingValue: 10.0,
        rating: null,
      },
      // Unpublished review
      {
        userId: user2Id,
        mediaItemId: media1Id,
        status: "unpublished",
        visibility: "public",
        isJournal: false,
        shareRating: true,
        ratingValue: 10.0,
        rating: null,
      },
      // Private review
      {
        userId: user3Id,
        mediaItemId: media1Id,
        status: "published",
        visibility: "private",
        isJournal: false,
        shareRating: true,
        ratingValue: 10.0,
        rating: null,
      },
      // Unlisted review
      {
        userId: user3Id,
        mediaItemId: media1Id,
        status: "published",
        visibility: "unlisted",
        isJournal: false,
        shareRating: true,
        ratingValue: 10.0,
        rating: null,
      },
      // Journal review with shareRating = false
      {
        userId: user2Id,
        mediaItemId: media1Id,
        status: "published",
        visibility: "public",
        isJournal: true,
        shareRating: false,
        ratingValue: 10.0,
        rating: null,
      },
      // Review for a completely different media item
      {
        userId: user1Id,
        mediaItemId: "other_media",
        status: "published",
        visibility: "public",
        isJournal: false,
        shareRating: true,
        ratingValue: 10.0,
        rating: null,
      },
    ];

    const result = communityAverage(media1Id, candidates);
    assert.ok(result);
    assert.equal(result.count, 1, "Only the 1 legitimate public review score must be counted");
    assert.equal(result.average, 8.0);
  });

  // ---------------------------------------------------------------------------
  // 4. Protection Against Ranking Rubric Scores & Tier Placements
  // ---------------------------------------------------------------------------
  it("never counts collection-scoped rubric ratings or tier placements as review ratings", () => {
    // Collection-scoped rating (e.g. ranked list rubric score)
    const collectionScore: CommunityRatingCandidate = {
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      rating: {
        userId: user1Id,
        mediaItemId: media1Id,
        collectionId: "col_123",
        tierId: null,
        sourceRating: null,
        sourceService: null,
        calculatedOverallScore: 9.5,
        ratingSystemId: null,
        ratingSystem: null,
      },
    };
    assert.equal(resolveReviewScoreOnTen(collectionScore), null, "Collection-scoped ratings must be rejected");

    // Tier placement rating
    const tierScore: CommunityRatingCandidate = {
      userId: user1Id,
      mediaItemId: media1Id,
      status: "published",
      visibility: "public",
      isJournal: false,
      shareRating: true,
      rating: {
        userId: user1Id,
        mediaItemId: media1Id,
        collectionId: null,
        tierId: "tier_s",
        sourceRating: null,
        sourceService: null,
        calculatedOverallScore: null,
        ratingSystemId: null,
        ratingSystem: null,
      },
    };
    assert.equal(resolveReviewScoreOnTen(tierScore), null, "Tier placements must be rejected from numerical ratings");

    // When only collection/tier ratings exist, community average returns null
    assert.equal(communityAverage(media1Id, [collectionScore, tierScore]), null);
  });

  // ---------------------------------------------------------------------------
  // 5. Zero Eligible Ratings Handled Gracefully
  // ---------------------------------------------------------------------------
  it("handles titles with zero eligible ratings gracefully without crashing or emitting NaN", () => {
    assert.equal(communityAverage(media2Id, []), null);
    assert.equal(
      communityAverage(media2Id, [
        {
          userId: user1Id,
          mediaItemId: media2Id,
          status: "published",
          visibility: "public",
          isJournal: false,
          shareRating: true,
          ratingValue: null,
          sourceRating: null,
          rating: null,
        },
      ]),
      null
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Rating Distribution Breakdown
  // ---------------------------------------------------------------------------
  it("produces an understandable 5-star distribution histogram with exact percentages", () => {
    const candidates: CommunityRatingCandidate[] = [
      // 5-star scores (9.0 - 10.0) -> 2 items
      { userId: user1Id, mediaItemId: media1Id, status: "published", visibility: "public", isJournal: false, shareRating: true, ratingValue: 9.5, rating: null },
      { userId: user2Id, mediaItemId: media1Id, status: "published", visibility: "public", isJournal: false, shareRating: true, ratingValue: 10.0, rating: null },
      // 4-star scores (7.0 - 8.9) -> 1 item
      { userId: user3Id, mediaItemId: media1Id, status: "published", visibility: "public", isJournal: false, shareRating: true, ratingValue: 8.0, rating: null },
      // 3-star scores (5.0 - 6.9) -> 1 item
      { userId: user1Id, mediaItemId: media1Id, status: "published", visibility: "public", isJournal: false, shareRating: true, ratingValue: 6.0, rating: null },
    ];

    const result = communityAverage(media1Id, candidates);
    assert.ok(result);
    assert.equal(result.count, 4);
    assert.equal(result.average, 8.4); // (9.5 + 10.0 + 8.0 + 6.0) / 4 = 33.5 / 4 = 8.375 -> 8.4
    assert.equal(result.starsAverage, 4.2);

    const buckets = result.distribution.buckets;
    assert.equal(buckets.find((b) => b.stars === 5)?.count, 2);
    assert.equal(buckets.find((b) => b.stars === 5)?.percentage, 50);
    assert.equal(buckets.find((b) => b.stars === 4)?.count, 1);
    assert.equal(buckets.find((b) => b.stars === 4)?.percentage, 25);
    assert.equal(buckets.find((b) => b.stars === 3)?.count, 1);
    assert.equal(buckets.find((b) => b.stars === 3)?.percentage, 25);
    assert.equal(buckets.find((b) => b.stars === 2)?.count, 0);
    assert.equal(buckets.find((b) => b.stars === 1)?.count, 0);
  });

  // ---------------------------------------------------------------------------
  // 7. Database Integration: getCommunityAverage and Safety Exclusions
  // ---------------------------------------------------------------------------
  it("queries authentic database reviews and respects blocklists in getCommunityAverage", async () => {
    // Insert 2 published reviews for media1Id: one from user1Id (8.0), one from blockedUserId (10.0)
    await db.insert(schema.reviews).values([
      {
        id: `rev_db_1_${suffix}`,
        userId: user1Id,
        mediaItemId: media1Id,
        status: "published",
        visibility: "public",
        ratingValue: 8.0,
        content: "Authentic public review from critic 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: `rev_db_blocked_${suffix}`,
        userId: blockedUserId,
        mediaItemId: media1Id,
        status: "published",
        visibility: "public",
        ratingValue: 2.0,
        content: "Review from blocked user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Without blocklist: both count -> (8 + 2) / 2 = 5.0, count = 2
    const allResult = await getCommunityAverage(media1Id);
    assert.ok(allResult);
    assert.equal(allResult.count, 2);
    assert.equal(allResult.average, 5.0);

    // With blocked user list: blocked user review is omitted -> only user1Id counts (8.0, count = 1)
    const blockedSet = new Set<string>([blockedUserId]);
    const filteredResult = await getCommunityAverage(media1Id, blockedSet);
    assert.ok(filteredResult);
    assert.equal(filteredResult.count, 1);
    assert.equal(filteredResult.average, 8.0);
  });

  // ---------------------------------------------------------------------------
  // 8. Public Rankings Query & Privacy Gating
  // ---------------------------------------------------------------------------
  it("surfaces public rankings featuring the title while strictly omitting private and unlisted rankings", async () => {
    // Query collection entries for media1Id
    const entries = await db.query.collectionEntries.findMany({
      where: eq(schema.collectionEntries.mediaItemId, media1Id),
      with: {
        collection: {
          with: {
            user: { columns: { id: true, name: true, username: true } },
          },
        },
      },
    });

    const publicRankings = entries.filter(
      (e: any) => e.collection && e.collection.visibility === "public"
    );

    // col1Id is public
    assert.equal(publicRankings.length, 1);
    assert.equal(publicRankings[0].collection.id, col1Id);
    assert.equal(publicRankings[0].collection.title, "Wes Anderson Ranked");
    assert.equal(publicRankings[0].sortOrder, 0); // #1 placement

    // col2Id is private, col3Id is unlisted; neither should be public
    const privateOrUnlisted = entries.filter(
      (e: any) => e.collection && e.collection.visibility !== "public"
    );
    assert.equal(privateOrUnlisted.length, 2);
    assert.ok(privateOrUnlisted.some((e: any) => e.collection.id === col2Id));
    assert.ok(privateOrUnlisted.some((e: any) => e.collection.id === col3Id));
  });

  // ---------------------------------------------------------------------------
  // 9. Ownership & Contextual Navigation Safety
  // ---------------------------------------------------------------------------
  it("enforces contextual Back navigation and ownership separation between Your View and Title Overview", () => {
    // Contextual URL generation
    const publicUrl = getPublicMediaUrl(media1Id, { from: "/?tab=journal&filter=viewings" });
    assert.ok(publicUrl.includes(`/media/${media1Id}`));
    assert.ok(publicUrl.includes("from=%2F%3Ftab%3Djournal%26filter%3Dviewings"));

    const personalUrl = getPersonalMediaUrl(media1Id, { from: "/?tab=journal&filter=viewings" });
    assert.ok(personalUrl.includes(`/media/${media1Id}?view=personal`));
    assert.ok(personalUrl.includes("from=%2F%3Ftab%3Djournal%26filter%3Dviewings"));

    // Back resolution returns to originating Journal view with filter intact
    const backInfo = getContextualBackInfo("/?tab=journal&filter=viewings", "overview");
    assert.equal(backInfo.href, "/?tab=journal&filter=viewings");
    assert.equal(backInfo.label, "Back to Journal");

    // Security: malicious external URLs are sanitized to safe fallbacks
    assert.equal(sanitizeInternalReturnUrl("https://evil.com/phish"), null);
    assert.equal(sanitizeInternalReturnUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeInternalReturnUrl("/discover"), "/discover");
  });
});
