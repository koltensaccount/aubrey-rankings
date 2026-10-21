import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import {
  mediaItems,
  ratings,
  reviews,
  user,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { POST as createReview, GET as getReviews } from "../app/api/reviews/route";
import { POST as postJournal } from "../app/api/journal/route";

describe("Phase 13 UX Completion: Journal Destination, Discover & Navigation Integration", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const ownerEmail = `curator_ux_${suffix}@example.com`;
  const visitorEmail = `visitor_ux_${suffix}@example.com`;

  let ownerId = "";
  let visitorId = "";
  let ownerCookie = "";
  let visitorCookie = "";

  const movieMediaId = `movie_ux_${suffix}`;
  const tvEpisodeMediaId = `tv_1313_s1_e1_${suffix}`;
  const trackedCreatedMediaItemIds: string[] = [movieMediaId, tvEpisodeMediaId];

  before(async () => {
    // 1. Create test owner user
    const ownerRes = await auth.api.signUpEmail({
      body: {
        name: "UX Curator",
        email: ownerEmail,
        password: "CuratorPassword123!",
      },
      asResponse: true,
    });
    assert.equal(ownerRes.status, 200);
    ownerCookie = ownerRes.headers.get("set-cookie") || "";
    const ownerAcc = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, ownerEmail),
    });
    assert.ok(ownerAcc);
    ownerId = ownerAcc.id;
    await db.update(user).set({ username: `curator_${suffix}`, emailVerified: true }).where(eq(user.id, ownerId));

    // 2. Create test visitor user
    const visitorRes = await auth.api.signUpEmail({
      body: {
        name: "UX Visitor",
        email: visitorEmail,
        password: "VisitorPassword123!",
      },
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

    // 3. Seed test media items
    await db.insert(mediaItems).values([
      {
        id: movieMediaId,
        tmdbId: 101010,
        mediaType: "movie",
        title: "UX Cinema Masterpiece",
        posterPath: "/poster_ux.jpg",
      },
      {
        id: tvEpisodeMediaId,
        tmdbId: 202020,
        mediaType: "episode",
        title: "UX TV Episode 1",
        seasonNumber: 1,
        episodeNumber: 1,
        stillPath: "/still_ux.jpg",
      },
    ]);
  });

  after(async () => {
    // Teardown test reviews
    await db.delete(reviews).where(eq(reviews.userId, ownerId));
    await db.delete(reviews).where(eq(reviews.userId, visitorId));

    // Teardown test ratings
    await db.delete(ratings).where(eq(ratings.userId, ownerId));
    await db.delete(ratings).where(eq(ratings.userId, visitorId));

    // Teardown seeded media items strictly by ID
    for (const id of trackedCreatedMediaItemIds) {
      await db.delete(mediaItems).where(eq(mediaItems.id, id));
    }

    // Teardown users
    await db.delete(user).where(eq(user.id, ownerId));
    await db.delete(user).where(eq(user.id, visitorId));
  });

  it("1. Journal API requires authentication and fails closed for visitors without session", async () => {
    const unauthedReq = new NextRequest("http://localhost:3000/api/journal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaItemId: movieMediaId, quickScore: 8 }),
    });
    const res = await postJournal(unauthedReq);
    assert.equal(res.status, 401, "Unauthenticated request to journal API must return 401");
  });

  it("2. User can create a draft journal entry and retrieve it privately", async () => {
    const postDraftReq = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
      },
      body: JSON.stringify({
        mediaItemId: movieMediaId,
        title: "Draft Thoughts on Masterpiece",
        content: "Still processing the second act cinematography.",
        status: "draft",
        visibility: "private",
        isSpoiler: false,
      }),
    });

    const createRes = await createReview(postDraftReq);
    assert.equal(createRes.status, 201, "Draft creation should succeed");
    const json = await createRes.json();
    assert.equal(json.review?.status, "draft");
    assert.equal(json.review?.visibility, "private");
    assert.equal(json.review?.title, "Draft Thoughts on Masterpiece");

    // Verify draft is stored in db for owner
    const stored = await db.query.reviews.findFirst({
      where: (r, { and, eq }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, movieMediaId)),
    });
    assert.ok(stored);
    assert.equal(stored.title, "Draft Thoughts on Masterpiece");
    assert.equal(stored.status, "draft");
  });

  it("3. Visitor cannot see owner's private journal draft via public endpoints", async () => {
    const visitorReq = new NextRequest(`http://localhost:3000/api/reviews?mediaItemId=${movieMediaId}`, {
      method: "GET",
      headers: { cookie: visitorCookie },
    });
    const listRes = await getReviews(visitorReq);
    assert.equal(listRes.status, 200);
    const data = await listRes.json();
    assert.equal(data.reviews.length, 0, "Private drafts must never be exposed to other users in reviews query");
  });

  it("4. Adding quick score in journal workflow updates rating independently without requiring a ranking", async () => {
    const postJournalReq = new NextRequest("http://localhost:3000/api/journal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
      },
      body: JSON.stringify({
        mediaItemId: tvEpisodeMediaId,
        quickScore: 9.5,
        review: {
          title: "Brilliant Episode",
          content: "Incredible performances and direction.",
          status: "published",
          visibility: "public",
          shareRating: true,
          isSpoiler: false,
        },
      }),
    });

    const journalRes = await postJournal(postJournalReq);
    assert.equal(journalRes.status, 200, "Journal post should succeed");
    const json = await journalRes.json();
    assert.ok(json.ratingId, "Journal response includes ratingId");
    assert.ok(json.review, "Journal response includes review");

    // Verify rating exists in database without collectionId
    const ownerRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, ownerId), eq(r.mediaItemId, tvEpisodeMediaId), isNull(r.collectionId)),
    });
    assert.ok(ownerRating, "Rating is stored in user's journal independently of any collection");
    assert.equal(ownerRating.calculatedOverallScore, 9.5);
  });

  it("5. getSafeCallbackUrl preserves target paths with query params and rejects open redirects", async () => {
    const { getSafeCallbackUrl } = await import("../lib/safe-url");

    assert.equal(getSafeCallbackUrl("/journal"), "/journal");
    assert.equal(getSafeCallbackUrl("/media/550?journal=1"), "/media/550?journal=1");
    assert.equal(getSafeCallbackUrl("/media/tv_1399_s1_e1?journal=1"), "/media/tv_1399_s1_e1?journal=1");
    assert.equal(getSafeCallbackUrl("/discover?q=fight"), "/discover?q=fight");

    // Rejection of malicious or open redirects
    assert.equal(getSafeCallbackUrl("https://malicious.com", "/profile"), "/profile");
    assert.equal(getSafeCallbackUrl("//evil.com/phish", "/profile"), "/profile");
    assert.equal(getSafeCallbackUrl("/\\evil.com", "/profile"), "/profile");
    assert.equal(getSafeCallbackUrl("javascript:alert(1)", "/profile"), "/profile");
    assert.equal(getSafeCallbackUrl(null, "/profile"), "/profile");
    assert.equal(getSafeCallbackUrl("", "/profile"), "/profile");
  });

  it("6. Watched-only items (score null) are distinguished from numerical ratings", async () => {
    const { reviewScoreOnTen } = await import("../lib/review-rating");

    // Watched-only entry (imported without rating)
    const watchedOnly = {
      calculatedOverallScore: null,
      sourceRating: null,
      sourceScale: 10,
      isWatched: true,
      categoryScores: [],
    } as any;
    assert.equal(reviewScoreOnTen(watchedOnly), null, "Watched-only items must produce null score");

    // Rated entry
    const ratedEntry = {
      calculatedOverallScore: 8.5,
      sourceRating: 8.5,
      sourceScale: 10,
      isWatched: true,
      categoryScores: [],
    } as any;
    assert.equal(reviewScoreOnTen(ratedEntry), 8.5, "Rated items must produce calculated numeric score");
  });
});
