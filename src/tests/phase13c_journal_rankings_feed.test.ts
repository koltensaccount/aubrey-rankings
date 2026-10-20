import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import {
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  reviews,
  user,
} from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { POST as addCollectionEntry, PUT as reorderCollectionEntries } from "../app/api/collections/[id]/entries/route";
import { GET as getFeed } from "../app/api/social/feed/route";
import { POST as createReview } from "../app/api/reviews/route";
import { canShowReviewRating } from "../lib/review-rating";
import { tmdb } from "../lib/tmdb";

describe("Phase 13C: Journal, Rankings & Feed Integration", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const ownerEmail = `owner_13c_${suffix}@example.com`;
  const visitorEmail = `visitor_13c_${suffix}@example.com`;

  let ownerId = "";
  let visitorId = "";
  let ownerCookie = "";
  let visitorCookie = "";

  const movieMediaId = `movie_test_${suffix}`;
  const episode1MediaId = `tv_9999_s1_e1_${suffix}`;
  const otherEpisodeMediaId = `tv_8888_s1_e1_${suffix}`;

  const customRankingId = `col_custom_${suffix}`;
  const franchiseRankingId = `col_franchise_${suffix}`;
  const tvSeriesRankingId = `col_tv_${suffix}`;

  const trackedCreatedMediaItemIds: string[] = [];

  const postEntryRequest = (
    colId: string,
    body: unknown,
    cookie: string
  ) =>
    new NextRequest(`http://localhost:3000/api/collections/${colId}/entries`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    });

  before(async () => {
    // 1. Create owner user
    const ownerRes = await auth.api.signUpEmail({
      body: { email: ownerEmail, password: "Password123!@#", name: "Ranking Owner" },
      asResponse: true,
    });
    assert.equal(ownerRes.status, 200);
    ownerCookie = ownerRes.headers.get("set-cookie") || "";
    const ownerAcc = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, ownerEmail),
    });
    assert.ok(ownerAcc);
    ownerId = ownerAcc.id;
    await db.update(user).set({ username: `owner_${suffix}`, emailVerified: true }).where(eq(user.id, ownerId));

    // 2. Create visitor user
    const visitorRes = await auth.api.signUpEmail({
      body: { email: visitorEmail, password: "Password123!@#", name: "Curious Visitor" },
      asResponse: true,
    });
    assert.equal(visitorRes.status, 200);
    visitorCookie = visitorRes.headers.get("set-cookie") || "";
    const visitorAcc = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, visitorEmail),
    });
    assert.ok(visitorAcc);
    visitorId = visitorAcc.id;
    await db.update(user).set({ username: `visitor_${suffix}`, emailVerified: true }).where(eq(user.id, visitorId));

    // 3. Seed media items (parent TV shows first, then episodes and movie)
    await db.insert(mediaItems).values([
      {
        id: `tv_9999_${suffix}`,
        mediaType: "tv",
        title: "Test Mystery Series",
        tmdbId: 9999,
      },
      {
        id: `tv_8888_${suffix}`,
        mediaType: "tv",
        title: "Foreign Television Show",
        tmdbId: 8888,
      },
      {
        id: movieMediaId,
        mediaType: "movie",
        title: "Test Movie 13C",
        tmdbId: 10001,
      },
      {
        id: episode1MediaId,
        mediaType: "episode",
        title: "Test Episode 1",
        tmdbId: 20001,
        seasonNumber: 1,
        episodeNumber: 1,
        parentMediaId: `tv_9999_${suffix}`,
      },
      {
        id: otherEpisodeMediaId,
        mediaType: "episode",
        title: "Foreign Show Episode",
        tmdbId: 30001,
        seasonNumber: 1,
        episodeNumber: 1,
        parentMediaId: `tv_8888_${suffix}`,
      },
    ]);

    // 4. Seed user collections: custom, movie_franchise, and tv_show
    await db.insert(collections).values([
      {
        id: customRankingId,
        userId: ownerId,
        title: "My All-Time Favorites",
        collectionType: "custom",
        visibility: "public",
        isPublic: true,
      },
      {
        id: franchiseRankingId,
        userId: ownerId,
        title: "Sci-Fi Film Franchise",
        collectionType: "movie_franchise",
        visibility: "public",
        isPublic: true,
      },
      {
        id: tvSeriesRankingId,
        userId: ownerId,
        title: "Mystery Series Episode Ranking",
        collectionType: "tv_show",
        tmdbId: 9999,
        visibility: "public",
        isPublic: true,
      },
    ]);

    // 5. Seed owner personal journal rating for movie (collectionId = null)
    await db.insert(ratings).values({
      id: `personal_rating_${suffix}`,
      userId: ownerId,
      mediaItemId: movieMediaId,
      collectionId: null,
      calculatedOverallScore: 9.4,
    });
  });

  after(async () => {
    await db.delete(reviews).where(eq(reviews.userId, ownerId));
    await db.delete(reviews).where(eq(reviews.userId, visitorId));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, customRankingId));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, franchiseRankingId));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, tvSeriesRankingId));
    await db.delete(ratings).where(eq(ratings.userId, ownerId));
    await db.delete(collections).where(eq(collections.userId, ownerId));

    // Clean up all tracked dynamic media records created during tests
    for (const id of trackedCreatedMediaItemIds) {
      await db.delete(collectionEntries).where(eq(collectionEntries.mediaItemId, id));
      await db.delete(mediaItems).where(eq(mediaItems.id, id));
    }
    await db.delete(mediaItems).where(eq(mediaItems.title, "Indie Short Film"));

    await db.delete(mediaItems).where(eq(mediaItems.id, movieMediaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, episode1MediaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, otherEpisodeMediaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, `tv_9999_${suffix}`));
    await db.delete(mediaItems).where(eq(mediaItems.id, `tv_8888_${suffix}`));
    await db.delete(user).where(eq(user.id, ownerId));
    await db.delete(user).where(eq(user.id, visitorId));
  });

  it("1. Adds a movie from Journal to an eligible custom or franchise ranking", async () => {
    // Add to movie franchise ranking
    const res = await addCollectionEntry(
      postEntryRequest(franchiseRankingId, { mediaItemId: movieMediaId }, ownerCookie),
      { params: Promise.resolve({ id: franchiseRankingId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.entry?.mediaItemId, movieMediaId);

    // Verify persisted in DB
    const persisted = await db.query.collectionEntries.findFirst({
      where: (ce, { and, eq }) =>
        and(eq(ce.collectionId, franchiseRankingId), eq(ce.mediaItemId, movieMediaId)),
    });
    assert.ok(persisted);
  });

  it("2. Adds an individual TV episode to a TV show ranking without identity mismatch", async () => {
    const res = await addCollectionEntry(
      postEntryRequest(tvSeriesRankingId, { mediaItemId: episode1MediaId }, ownerCookie),
      { params: Promise.resolve({ id: tvSeriesRankingId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.entry?.mediaItemId, episode1MediaId);

    // Check media metadata preserved
    const entry = await db.query.collectionEntries.findFirst({
      where: (ce, { and, eq }) =>
        and(eq(ce.collectionId, tvSeriesRankingId), eq(ce.mediaItemId, episode1MediaId)),
      with: { mediaItem: true },
    });
    assert.equal(entry?.mediaItem?.mediaType, "episode");
    assert.equal(entry?.mediaItem?.seasonNumber, 1);
    assert.equal(entry?.mediaItem?.episodeNumber, 1);
  });

  it("3. Enforces duplicate prevention and collection type compatibility", async () => {
    // Duplicate check: movie already in franchise ranking
    const dupRes = await addCollectionEntry(
      postEntryRequest(franchiseRankingId, { mediaItemId: movieMediaId }, ownerCookie),
      { params: Promise.resolve({ id: franchiseRankingId }) }
    );
    assert.equal(dupRes.status, 409);
    const dupBody = await dupRes.json();
    assert.match(dupBody.error, /already included/i);

    // Incompatible: adding an episode to a movie franchise ranking
    const epToFranchise = await addCollectionEntry(
      postEntryRequest(franchiseRankingId, { mediaItemId: episode1MediaId }, ownerCookie),
      { params: Promise.resolve({ id: franchiseRankingId }) }
    );
    assert.equal(epToFranchise.status, 400);
    const epToFranchiseBody = await epToFranchise.json();
    assert.match(epToFranchiseBody.error, /only accept films/i);

    // Incompatible: adding a movie to a TV show ranking
    const movieToTv = await addCollectionEntry(
      postEntryRequest(tvSeriesRankingId, { mediaItemId: movieMediaId }, ownerCookie),
      { params: Promise.resolve({ id: tvSeriesRankingId }) }
    );
    assert.equal(movieToTv.status, 400);
    const movieToTvBody = await movieToTv.json();
    assert.match(movieToTvBody.error, /only accept episodes/i);

    // Incompatible series: episode from show 8888 added to show 9999 ranking
    const foreignEp = await addCollectionEntry(
      postEntryRequest(tvSeriesRankingId, { mediaItemId: otherEpisodeMediaId }, ownerCookie),
      { params: Promise.resolve({ id: tvSeriesRankingId }) }
    );
    assert.equal(foreignEp.status, 400);
    const foreignEpBody = await foreignEp.json();
    assert.match(foreignEpBody.error, /does not belong to the television series/i);
  });

  it("4. Guarantees that adding an item does not transfer or overwrite journal ratings (Independent Scoring)", async () => {
    // Owner adds movie to custom ranking
    const res = await addCollectionEntry(
      postEntryRequest(customRankingId, { mediaItemId: movieMediaId }, ownerCookie),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    assert.equal(res.status, 200);

    // Verify personal journal rating remains 9.4 with collectionId = null
    const personalRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, ownerId), eq(r.mediaItemId, movieMediaId), isNull(r.collectionId)),
    });
    assert.equal(personalRating?.calculatedOverallScore, 9.4);

    // Verify NO collection rating was created or transferred
    const collectionRating = await db.query.ratings.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.userId, ownerId), eq(r.mediaItemId, movieMediaId), eq(r.collectionId, customRankingId)),
    });
    assert.equal(collectionRating, undefined);
  });

  it("5. Strictly restricts collection modification to the owner", async () => {
    // Visitor tries to add an item to owner's collection
    const unauthAdd = await addCollectionEntry(
      postEntryRequest(customRankingId, { mediaItemId: episode1MediaId }, visitorCookie),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    // Should fail with 404 (not found or access denied)
    assert.equal(unauthAdd.status, 404);

    // Visitor tries to reorder entries in owner's collection
    const unauthReorder = await reorderCollectionEntries(
      new NextRequest(`http://localhost:3000/api/collections/${customRankingId}/entries`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: visitorCookie },
        body: JSON.stringify({ entries: [] }),
      }),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    assert.equal(unauthReorder.status, 404);
  });

  it("6. Honors review visibility states (public in feed vs unlisted, private, draft excluded)", async () => {
    // Create public review
    const pubReq = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: movieMediaId,
        title: "Public Review Title",
        content: "Detailed thoughts visible to community.",
        status: "published",
        visibility: "public",
        shareRating: true,
      }),
    });
    const pubRes = await createReview(pubReq);
    assert.equal(pubRes.status, 201);
    const pubData = await pubRes.json();
    const publicReviewId = pubData.review.id;

    // Create unlisted review
    const unlistedReq = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: episode1MediaId,
        title: "Unlisted Episode Note",
        content: "Only accessible via direct link.",
        status: "published",
        visibility: "unlisted",
      }),
    });
    const unlistedRes = await createReview(unlistedReq);
    assert.equal(unlistedRes.status, 201);
    const unlistedData = await unlistedRes.json();
    const unlistedReviewId = unlistedData.review.id;

    // Create private review
    const privateReq = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: otherEpisodeMediaId,
        title: "Private Diary Entry",
        content: "Private to my eyes only.",
        status: "published",
        visibility: "private",
      }),
    });
    const privateRes = await createReview(privateReq);
    assert.equal(privateRes.status, 201);
    const privateData = await privateRes.json();
    const privateReviewId = privateData.review.id;

    // Check Community Feed: discover mode
    const feedReq = new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=reviews");
    const feedRes = await getFeed(feedReq);
    assert.equal(feedRes.status, 200);
    const feedData = await feedRes.json();

    const reviewIdsInFeed = feedData.items.map((i: any) => i.review?.id || i.contentId);

    // Public review IS in feed
    assert.ok(reviewIdsInFeed.includes(publicReviewId), "Public review must be in community feed");

    // Unlisted and private reviews MUST NOT be in feed
    assert.equal(reviewIdsInFeed.includes(unlistedReviewId), false, "Unlisted review must not appear in feed");
    assert.equal(reviewIdsInFeed.includes(privateReviewId), false, "Private review must not appear in feed");
  });

  it("7. Enforces explicit score-sharing consent (shareRating: false hides score from viewers)", () => {
    // Case A: shareRating is true -> viewer can see score
    const withConsent = canShowReviewRating(
      { isJournal: true, shareRating: true, userId: ownerId },
      visitorId
    );
    assert.equal(withConsent, true);

    // Case B: shareRating is false -> visitor cannot see score
    const withoutConsent = canShowReviewRating(
      { isJournal: true, shareRating: false, userId: ownerId },
      visitorId
    );
    assert.equal(withoutConsent, false);

    // Case C: author themselves can always see their own score
    const authorView = canShowReviewRating(
      { isJournal: true, shareRating: false, userId: ownerId },
      ownerId
    );
    assert.equal(authorView, true);
  });

  it("8. Adding an item to a ranking does not cause accidental Feed publication", async () => {
    // Query reviews for owner
    const existingReviewsCount = (
      await db.query.reviews.findMany({
        where: (rv, { eq }) => eq(rv.userId, ownerId),
      })
    ).length;

    // Add another item to custom collection
    await addCollectionEntry(
      postEntryRequest(customRankingId, { mediaItemId: episode1MediaId }, ownerCookie),
      { params: Promise.resolve({ id: customRankingId }) }
    );

    // Reviews count remains identical (no automatic review created or published)
    const afterCount = (
      await db.query.reviews.findMany({
        where: (rv, { eq }) => eq(rv.userId, ownerId),
      })
    ).length;

    assert.equal(afterCount, existingReviewsCount);
  });

  it("9. Existing ranking workflows remain functional (customTitle and reordering)", async () => {
    // 9a. Add custom entry without TMDB
    const customRes = await addCollectionEntry(
      postEntryRequest(customRankingId, { customTitle: "Indie Short Film" }, ownerCookie),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    assert.equal(customRes.status, 200);
    const customData = await customRes.json();
    assert.equal(customData.success, true);
    assert.equal(customData.entry?.mediaItem?.title, "Indie Short Film");
    if (customData.entry?.mediaItemId) {
      trackedCreatedMediaItemIds.push(customData.entry.mediaItemId);
    }

    // 9b. Reorder entries
    const entries = await db.query.collectionEntries.findMany({
      where: (ce, { eq }) => eq(ce.collectionId, customRankingId),
    });
    assert.ok(entries.length >= 2);

    const reordered = entries.map((e, idx) => ({ id: e.id, sortOrder: entries.length - idx }));
    const putRes = await reorderCollectionEntries(
      new NextRequest(`http://localhost:3000/api/collections/${customRankingId}/entries`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ entries: reordered }),
      }),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    assert.equal(putRes.status, 200);
  });

  it("10. Adds an unsaved episode with neither episode nor parent series stored in DB (mocks TMDB, verifies parent foreign key and identity)", async () => {
    const unsavedTvId = 887766;
    const unsavedEpId = `tv_${unsavedTvId}_s1_e3`;

    // Verify neither parent series nor episode exists in DB beforehand
    assert.equal(
      await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, `tv_${unsavedTvId}`) }),
      undefined
    );
    assert.equal(
      await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, unsavedEpId) }),
      undefined
    );

    // Mock TMDB API methods
    const originalGetTvDetails = tmdb.getTvDetails;
    const originalGetTvSeason = tmdb.getTvSeason;

    (tmdb as any).getTvDetails = async (id: number) => {
      if (id === unsavedTvId) {
        return {
          id: unsavedTvId,
          name: "The Unsaved Mystery Series",
          overview: "A brand new show fetched from TMDB",
          first_air_date: "2026-02-01",
          vote_average: 8.9,
          vote_count: 42,
        };
      }
      return originalGetTvDetails.call(tmdb, id);
    };

    (tmdb as any).getTvSeason = async (tvId: number, seasonNumber: number) => {
      if (tvId === unsavedTvId && seasonNumber === 1) {
        return {
          id: 555,
          season_number: 1,
          episodes: [
            {
              id: 998877,
              name: "The First Discovery",
              overview: "An unsaved episode appears.",
              still_path: "/still_ep3.jpg",
              air_date: "2026-02-15",
              episode_number: 3,
              season_number: 1,
              vote_average: 9.2,
            },
          ],
        };
      }
      return originalGetTvSeason.call(tmdb, tvId, seasonNumber);
    };

    try {
      // Add unsaved episode to custom collection
      const res = await addCollectionEntry(
        postEntryRequest(customRankingId, { mediaItemId: unsavedEpId }, ownerCookie),
        { params: Promise.resolve({ id: customRankingId }) }
      );
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.entry?.mediaItemId, unsavedEpId);

      // Verify parent TV show was automatically created in DB to satisfy foreign key
      const parentInDb = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, `tv_${unsavedTvId}`),
      });
      assert.ok(parentInDb, "Parent TV series must be created in DB");
      assert.equal(parentInDb.title, "The Unsaved Mystery Series");

      // Verify episode record was created and correctly points to parent TV show
      const epInDb = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.id, unsavedEpId),
      });
      assert.ok(epInDb, "Episode must be created in DB");
      assert.equal(epInDb.parentMediaId, `tv_${unsavedTvId}`);
      assert.equal(epInDb.seasonNumber, 1);
      assert.equal(epInDb.episodeNumber, 3);
      assert.equal(epInDb.title, "The First Discovery");

      // Verify membership in collection
      const entryInDb = await db.query.collectionEntries.findFirst({
        where: (ce, { and, eq }) =>
          and(eq(ce.collectionId, customRankingId), eq(ce.mediaItemId, unsavedEpId)),
      });
      assert.ok(entryInDb, "Collection entry must be created");

      trackedCreatedMediaItemIds.push(unsavedEpId);
      trackedCreatedMediaItemIds.push(`tv_${unsavedTvId}`);
    } finally {
      tmdb.getTvDetails = originalGetTvDetails;
      tmdb.getTvSeason = originalGetTvSeason;
    }
  });

  it("11. Handles malformed encoded media IDs gracefully (returns 404 rather than 500)", async () => {
    // Malformed URI string (invalid escape sequence)
    const malformedId = "movie_%ZZ_invalid";
    const res = await addCollectionEntry(
      postEntryRequest(customRankingId, { mediaItemId: malformedId }, ownerCookie),
      { params: Promise.resolve({ id: customRankingId }) }
    );
    // Must return 404 (not found) and NOT crash with unhandled 500
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /could not be resolved/i);
  });
});
