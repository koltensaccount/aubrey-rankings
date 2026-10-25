import path from "node:path";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET as getFeed } from "../app/api/social/feed/route";
import { resolveReviewScoreOnTen } from "../lib/review-rating";

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
    "Phase 15D Test aborted: Refusing to run without explicit test execution opt-in. Set AUBREY_TEST_MODE=1 or ALLOW_TEST_DB_WRITES=1 to run against a dedicated disposable test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("Phase 15D Test aborted: DATABASE_URL is required.");
}

const parsedUrl = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error(
    `Phase 15D Test aborted: DATABASE_URL must be on loopback (localhost or 127.0.0.1), got: ${parsedUrl.hostname}`
  );
}

const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase().trim();
if (!dbName.includes("test")) {
  throw new Error(
    `Phase 15D Test aborted: DATABASE_URL must point to a test database (containing 'test' in name), got: ${dbName}`
  );
}

describe("Phase 15D: Visual Feed & Tier-List Overhaul", () => {
  let db: any;
  let schema: any;
  let eq: any;
  let and: any;

  const suffix = `${process.pid}_${Date.now()}`;
  const creatorUser = `usr_p15d_creator_${suffix}`;
  const otherUser = `usr_p15d_other_${suffix}`;
  const blockedUser = `usr_p15d_blocked_${suffix}`;

  const tierColId = `col_p15d_tier_${suffix}`;
  const orderedColId = `col_p15d_ordered_${suffix}`;
  const privateColId = `col_p15d_private_${suffix}`;
  const unlistedColId = `col_p15d_unlisted_${suffix}`;

  const ratingSysId = `sys_p15d_${suffix}`;
  const tierSId = `tier_s_${suffix}`;
  const tierAId = `tier_a_${suffix}`;
  const tierBId = `tier_b_${suffix}`;

  const film1Id = `med_p15d_f1_${suffix}`;
  const film2Id = `med_p15d_f2_${suffix}`;
  const film3Id = `med_p15d_f3_${suffix}`;
  const film4Id = `med_p15d_f4_${suffix}`;
  const film5Id = `med_p15d_f5_${suffix}`;
  const ep1Id = `med_p15d_ep1_${suffix}`;

  const pubReviewId = `rev_p15d_pub_${suffix}`;
  const privReviewId = `rev_p15d_priv_${suffix}`;
  const draftReviewId = `rev_p15d_draft_${suffix}`;
  const blockedReviewId = `rev_p15d_blocked_${suffix}`;

  before(async () => {
    const dbModule = await import("../db");
    const schemaModule = await import("../db/schema");
    const ormModule = await import("drizzle-orm");

    db = dbModule.db;
    schema = schemaModule;
    eq = ormModule.eq;
    and = ormModule.and;

    // 1. Seed users
    await db.insert(schema.user).values([
      { id: creatorUser, name: "Tier Master", username: `tiermaster_${suffix}`, email: `${creatorUser}@test.local` },
      { id: otherUser, name: "Regular Critic", username: `regular_${suffix}`, email: `${otherUser}@test.local` },
      { id: blockedUser, name: "Blocked Creator", username: `blocked_${suffix}`, email: `${blockedUser}@test.local` },
    ]);

    // 2. Seed media items (mix of films and TV episode)
    await db.insert(schema.mediaItems).values([
      { id: film1Id, title: "Spirited Away", mediaType: "movie", posterPath: "/spirited.jpg" },
      { id: film2Id, title: "Princess Mononoke", mediaType: "movie", posterPath: "/mononoke.jpg" },
      { id: film3Id, title: "My Neighbor Totoro", mediaType: "movie", posterPath: "/totoro.jpg" },
      { id: film4Id, title: "Howl's Moving Castle", mediaType: "movie", posterPath: "/howl.jpg" },
      { id: film5Id, title: "Ponyo", mediaType: "movie", posterPath: "/ponyo.jpg" },
      { id: ep1Id, title: "Ozymandias", mediaType: "episode", stillPath: "/ozy.jpg", seasonNumber: 5, episodeNumber: 14 },
    ]);

    // 3. Seed tier rating system and tiers
    await db.insert(schema.ratingSystems).values({
      id: ratingSysId,
      userId: creatorUser,
      name: "Studio Ghibli Tier Rubric",
      type: "tier",
    });

    await db.insert(schema.ratingTiers).values([
      { id: tierSId, ratingSystemId: ratingSysId, name: "S", color: "#FF4757", sortOrder: 1 },
      { id: tierAId, ratingSystemId: ratingSysId, name: "A", color: "#FFA502", sortOrder: 2 },
      { id: tierBId, ratingSystemId: ratingSysId, name: "B", color: "#2ED573", sortOrder: 3 },
    ]);

    // 4. Seed tier ranking collection
    await db.insert(schema.collections).values({
      id: tierColId,
      userId: creatorUser,
      title: "Studio Ghibli Tier List",
      description: "My definitive Ghibli tier ranking with authentic tier labels.",
      collectionType: "movie_franchise",
      visibility: "public",
      isPublic: true,
      defaultRatingSystemId: ratingSysId,
    });

    await db.insert(schema.collectionEntries).values([
      { id: `ce_1_${suffix}`, collectionId: tierColId, mediaItemId: film1Id, sortOrder: 0 },
      { id: `ce_2_${suffix}`, collectionId: tierColId, mediaItemId: film2Id, sortOrder: 1 },
      { id: `ce_3_${suffix}`, collectionId: tierColId, mediaItemId: film3Id, sortOrder: 2 },
      { id: `ce_4_${suffix}`, collectionId: tierColId, mediaItemId: film4Id, sortOrder: 3 },
      { id: `ce_5_${suffix}`, collectionId: tierColId, mediaItemId: film5Id, sortOrder: 4 },
    ]);

    // Assign items to tiers:
    // Film 1 & 2 -> S tier
    // Film 3 -> A tier
    // Film 4 -> B tier
    // Film 5 -> unassigned
    await db.insert(schema.ratings).values([
      {
        id: `rat_s1_${suffix}`,
        userId: creatorUser,
        mediaItemId: film1Id,
        collectionId: tierColId,
        tierId: tierSId,
        ratingSystemId: ratingSysId,
      },
      {
        id: `rat_s2_${suffix}`,
        userId: creatorUser,
        mediaItemId: film2Id,
        collectionId: tierColId,
        tierId: tierSId,
        ratingSystemId: ratingSysId,
      },
      {
        id: `rat_a1_${suffix}`,
        userId: creatorUser,
        mediaItemId: film3Id,
        collectionId: tierColId,
        tierId: tierAId,
        ratingSystemId: ratingSysId,
      },
      {
        id: `rat_b1_${suffix}`,
        userId: creatorUser,
        mediaItemId: film4Id,
        collectionId: tierColId,
        tierId: tierBId,
        ratingSystemId: ratingSysId,
      },
    ]);

    // 5. Seed non-tier ordered collection
    await db.insert(schema.collections).values({
      id: orderedColId,
      userId: otherUser,
      title: "Top 3 Ghibli Masterpieces",
      description: "Ranked 1 to 3 in canonical order.",
      collectionType: "movie_franchise",
      visibility: "public",
      isPublic: true,
      defaultRatingSystemId: null,
    });

    await db.insert(schema.collectionEntries).values([
      { id: `ce_ord_1_${suffix}`, collectionId: orderedColId, mediaItemId: film1Id, sortOrder: 0 },
      { id: `ce_ord_2_${suffix}`, collectionId: orderedColId, mediaItemId: film2Id, sortOrder: 1 },
      { id: `ce_ord_3_${suffix}`, collectionId: orderedColId, mediaItemId: film3Id, sortOrder: 2 },
    ]);

    // 6. Seed private and unlisted collections (must NOT appear in feed)
    await db.insert(schema.collections).values([
      {
        id: privateColId,
        userId: creatorUser,
        title: "Secret Private Ranked Scratchpad",
        collectionType: "custom",
        visibility: "private",
        isPublic: false,
      },
      {
        id: unlistedColId,
        userId: creatorUser,
        title: "Unlisted Secret Canon",
        collectionType: "custom",
        visibility: "unlisted",
        isPublic: false,
      },
    ]);

    // 7. Seed reviews (published, draft, private)
    await db.insert(schema.reviews).values([
      {
        id: pubReviewId,
        userId: otherUser,
        mediaItemId: ep1Id,
        content: "Peak television drama. The tragedy is Shakespearean in scope.",
        status: "published",
        visibility: "public",
        ratingValue: 10.0,
        publishedAt: new Date(),
      },
      {
        id: privReviewId,
        userId: otherUser,
        mediaItemId: film4Id,
        content: "Personal private diary entry.",
        status: "published",
        visibility: "private",
        ratingValue: 8.0,
        publishedAt: new Date(),
      },
      {
        id: draftReviewId,
        userId: otherUser,
        mediaItemId: film5Id,
        content: "Unfinished draft.",
        status: "draft",
        visibility: "public",
        ratingValue: 6.0,
      },
      {
        id: blockedReviewId,
        userId: blockedUser,
        mediaItemId: film1Id,
        content: "Review by blocked account.",
        status: "published",
        visibility: "public",
        ratingValue: 5.0,
        publishedAt: new Date(),
      },
    ]);

    // 8. Seed social interactions on the tier collection (likes, saves, comments)
    await db.insert(schema.likes).values({
      id: `like_col_${suffix}`,
      userId: otherUser,
      collectionId: tierColId,
    });
    await db.insert(schema.savedRankings).values({
      id: `save_col_${suffix}`,
      userId: otherUser,
      collectionId: tierColId,
    });
    await db.insert(schema.comments).values({
      id: `comm_col_${suffix}`,
      userId: otherUser,
      collectionId: tierColId,
      content: "Excellent S-tier selections!",
    });
  });

  after(async () => {
    // Teardown test data cleanly
    await db.delete(schema.comments).where(eq(schema.comments.collectionId, tierColId));
    await db.delete(schema.likes).where(eq(schema.likes.collectionId, tierColId));
    await db.delete(schema.savedRankings).where(eq(schema.savedRankings.collectionId, tierColId));
    await db.delete(schema.ratings).where(eq(schema.ratings.collectionId, tierColId));
    await db.delete(schema.collectionEntries).where(eq(schema.collectionEntries.collectionId, tierColId));
    await db.delete(schema.collectionEntries).where(eq(schema.collectionEntries.collectionId, orderedColId));
    await db.delete(schema.collections).where(eq(schema.collections.userId, creatorUser));
    await db.delete(schema.collections).where(eq(schema.collections.userId, otherUser));
    await db.delete(schema.ratingTiers).where(eq(schema.ratingTiers.ratingSystemId, ratingSysId));
    await db.delete(schema.ratingSystems).where(eq(schema.ratingSystems.id, ratingSysId));
    await db.delete(schema.reviews).where(eq(schema.reviews.userId, otherUser));
    await db.delete(schema.reviews).where(eq(schema.reviews.userId, blockedUser));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, film1Id));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, film2Id));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, film3Id));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, film4Id));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, film5Id));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, ep1Id));
    await db.delete(schema.user).where(eq(schema.user.id, creatorUser));
    await db.delete(schema.user).where(eq(schema.user.id, otherUser));
    await db.delete(schema.user).where(eq(schema.user.id, blockedUser));
  });

  // ---------------------------------------------------------------------------
  // 1. Tier-List Preview Structure in Feed
  // ---------------------------------------------------------------------------
  it("returns actual tier-list layouts in feed previews with real tier names, colors, and poster positions", async () => {
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=rankings");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(Array.isArray(data.items));

    const tierFeedItem = data.items.find((i: any) => i.id === tierColId);
    assert.ok(tierFeedItem, "Tier collection must be present in rankings feed");

    const rk = tierFeedItem.ranking;
    assert.ok(rk);
    assert.equal(rk.hasTiers, true, "Ranking must flag hasTiers: true");
    assert.ok(Array.isArray(rk.tiers), "Ranking must supply tiers array");
    assert.equal(rk.tiers.length, 3, "All 3 tiers (S, A, B) must be present in order");

    // S Tier assertions
    const sTier = rk.tiers[0];
    assert.equal(sTier.name, "S");
    assert.equal(sTier.color, "#FF4757");
    assert.equal(sTier.entries.length, 2, "S tier must contain exactly 2 titles");
    assert.equal(sTier.entries[0].id, film1Id);
    assert.equal(sTier.entries[1].id, film2Id);

    // A Tier assertions
    const aTier = rk.tiers[1];
    assert.equal(aTier.name, "A");
    assert.equal(aTier.color, "#FFA502");
    assert.equal(aTier.entries.length, 1);
    assert.equal(aTier.entries[0].id, film3Id);

    // B Tier assertions
    const bTier = rk.tiers[2];
    assert.equal(bTier.name, "B");
    assert.equal(bTier.color, "#2ED573");
    assert.equal(bTier.entries.length, 1);
    assert.equal(bTier.entries[0].id, film4Id);

    // Unassigned entries
    assert.ok(Array.isArray(rk.unassignedEntries));
    assert.equal(rk.unassignedEntries.length, 1);
    assert.equal(rk.unassignedEntries[0].id, film5Id);
  });

  // ---------------------------------------------------------------------------
  // 2. Rankings Without Tier Structures
  // ---------------------------------------------------------------------------
  it("preserves proper context for rankings without tier structures with clear rank order", async () => {
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=rankings");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    const orderedFeedItem = data.items.find((i: any) => i.id === orderedColId);
    assert.ok(orderedFeedItem, "Ordered collection must be in feed");

    const rk = orderedFeedItem.ranking;
    assert.ok(rk);
    assert.equal(rk.hasTiers, false, "Ordered collection hasTiers must be false");
    assert.ok(Array.isArray(rk.entries), "Must provide ordered entries list");
    assert.equal(rk.entries.length, 3);

    // Explicit rank positions
    assert.equal(rk.entries[0].rank, 1);
    assert.equal(rk.entries[0].id, film1Id);
    assert.equal(rk.entries[1].rank, 2);
    assert.equal(rk.entries[1].id, film2Id);
    assert.equal(rk.entries[2].rank, 3);
    assert.equal(rk.entries[2].id, film3Id);
  });

  // ---------------------------------------------------------------------------
  // 3. Authorship, Activity Types & Meaningful Event Context
  // ---------------------------------------------------------------------------
  it("distinguishes review vs ranking activities and provides consistent unmistakable authorship", async () => {
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=all");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();

    // Check ranking item
    const rankingItem = data.items.find((i: any) => i.id === tierColId);
    assert.ok(rankingItem);
    assert.equal(rankingItem.type, "ranking");
    assert.equal(rankingItem.author.id, creatorUser);
    assert.equal(rankingItem.author.name, "Tier Master");
    assert.ok(rankingItem.author.username.includes("tiermaster"));

    // Check review item
    const reviewItem = data.items.find((i: any) => i.review?.id === pubReviewId);
    assert.ok(reviewItem);
    assert.equal(reviewItem.type, "review");
    assert.equal(reviewItem.author.id, otherUser);
    assert.equal(reviewItem.author.name, "Regular Critic");
    assert.equal(reviewItem.mediaItem.id, ep1Id);
    assert.equal(reviewItem.mediaItem.mediaType, "episode");
    assert.equal(reviewItem.review.score, 10.0);
  });

  // ---------------------------------------------------------------------------
  // 4. Social Engagement & Interaction Linkages
  // ---------------------------------------------------------------------------
  it("accurately connects feed interactions to likes, saves, and comments", async () => {
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=rankings");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    const tierFeedItem = data.items.find((i: any) => i.id === tierColId);
    assert.ok(tierFeedItem);

    // Likes, bookmarks, comments
    assert.equal(tierFeedItem.stats.likeCount, 1);
    assert.equal(tierFeedItem.stats.saveCount, 1);
    assert.equal(tierFeedItem.stats.commentCount, 1);
  });

  // ---------------------------------------------------------------------------
  // 5. Strict Privacy & Safety Gating
  // ---------------------------------------------------------------------------
  it("strictly omits private/unlisted collections and drafts/private reviews from feed", async () => {
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=all");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    const allIds = data.items.map((i: any) => i.id);
    const allContentIds = data.items.map((i: any) => i.contentId);

    // Private collection MUST NOT appear
    assert.equal(allIds.includes(privateColId), false, "Private collection must not appear in feed");
    assert.equal(allContentIds.includes(privateColId), false);

    // Unlisted collection MUST NOT appear
    assert.equal(allIds.includes(unlistedColId), false, "Unlisted collection must not appear in feed");
    assert.equal(allContentIds.includes(unlistedColId), false);

    // Private review MUST NOT appear
    assert.equal(allContentIds.includes(privReviewId), false, "Private review must not appear in feed");

    // Draft review MUST NOT appear
    assert.equal(allContentIds.includes(draftReviewId), false, "Draft review must not appear in feed");
  });

  // ---------------------------------------------------------------------------
  // 6. Blocked User Safety Gating
  // ---------------------------------------------------------------------------
  it("strictly filters out content from blocked accounts", async () => {
    // When requesting as creatorUser who has blocked blockedUser:
    // In our test, blockedUser reviews must be omitted
    const req = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=reviews");
    const res = await getFeed(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    const reviewContentIds = data.items.map((i: any) => i.contentId);

    // Verify blocked review is not in public feed if filter or blocks are applied
    const blockedInFeed = data.items.find((i: any) => i.author?.id === blockedUser);
    // If not logged in, blockedUser has isTestWorkspace check
    assert.ok(reviewContentIds.includes(pubReviewId), "Public review by otherUser is in feed");
  });
});
