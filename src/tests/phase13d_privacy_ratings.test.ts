import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "../db";
import { mediaItems, ratings, reviews, user } from "../db/schema";
import { POST as saveJournal } from "../app/api/journal/route";
import { GET as getReview, DELETE as deleteReview } from "../app/api/reviews/[id]/route";
import { GET as listReviews } from "../app/api/reviews/route";
import { GET as mediaReviews } from "../app/api/media/[id]/reviews/route";
import { GET as getFeed } from "../app/api/social/feed/route";
import { getPublicReviews } from "../lib/public-reviews";
import { communityAverage, tmdbAudienceRating, type CommunityRatingCandidate } from "../lib/review-rating";

describe("Phase 13D review score consent", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `privacy_${suffix}@example.com`;
  const mediaId = `privacy_media_${suffix}`;
  let userId = "", cookie = "", reviewId = "";
  const request = (body: unknown) => new NextRequest("http://localhost:3000/api/journal", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  const read = (owner = false) => getReview(new NextRequest(`http://localhost:3000/api/reviews/${reviewId}`, { headers: owner ? { cookie } : {} }), { params: Promise.resolve({ id: reviewId }) });
  before(async () => {
    const signup = await auth.api.signUpEmail({ body: { email, name: "Privacy tester", password: "Password123!@#" }, asResponse: true });
    assert.equal(signup.status, 200); cookie = signup.headers.get("set-cookie") || "";
    const record = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) }); assert.ok(record); userId = record.id;
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Privacy test" });
  });
  after(async () => { await db.delete(reviews).where(eq(reviews.userId, userId)); await db.delete(ratings).where(eq(ratings.userId, userId)); await db.delete(mediaItems).where(eq(mediaItems.id, mediaId)); await db.delete(user).where(eq(user.id, userId)); });

  it("keeps a public journal score private by default while retaining owner access", async () => {
    const response = await saveJournal(request({ mediaItemId: mediaId, quickScore: 8, review: { content: "Writing", status: "published", visibility: "public" } }));
    assert.equal(response.status, 200); reviewId = (await response.json()).review.id;
    assert.equal((await (await read()).json()).review.rating, null);
    assert.equal((await (await read(true)).json()).review.rating.score, 8);
    const list = await listReviews(new NextRequest(`http://localhost:3000/api/reviews?mediaItemId=${mediaId}`));
    assert.equal((await list.json()).reviews[0].rating, null);
    const media = await mediaReviews(new NextRequest(`http://localhost:3000/api/media/${mediaId}/reviews`), { params: Promise.resolve({ id: mediaId }) });
    assert.equal((await media.json()).reviews[0].score, null);
    const feed = await getFeed(new NextRequest("http://localhost:3000/api/social/feed?mode=discover&filter=reviews&limit=50"));
    const feedItem = (await feed.json()).items.find((item: { contentId: string }) => item.contentId === reviewId);
    assert.ok(feedItem); assert.equal(feedItem.review.score, null);
    assert.equal((await getPublicReviews(userId)).find((review) => review.id === reviewId)?.calculatedOverallScore, null);
  });
  it("preserves explicitly attached legacy independent review ratings", async () => {
    const journal = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) }); assert.ok(journal?.ratingId);
    const id = `legacy_${suffix}`;
    await db.insert(reviews).values({ id, userId, mediaItemId: mediaId, ratingId: journal.ratingId, content: "Legacy review", status: "published", visibility: "public" });
    const result = await getReview(new NextRequest(`http://localhost:3000/api/reviews/${id}`), { params: Promise.resolve({ id }) });
    assert.equal((await result.json()).review.rating.score, 8);
    await db.delete(reviews).where(eq(reviews.id, id));
  });
  it("persists explicit consent, supports unlisted direct access, and revokes it", async () => {
    let result = await saveJournal(request({ mediaItemId: mediaId, review: { id: reviewId, content: "Writing", status: "published", visibility: "unlisted", shareRating: true } }));
    assert.equal(result.status, 200); assert.equal((await (await read()).json()).review.rating.score, 8);
    result = await saveJournal(request({ mediaItemId: mediaId, review: { id: reviewId, content: "Writing", status: "published", visibility: "public", shareRating: false } }));
    assert.equal(result.status, 200); assert.equal((await (await read()).json()).review.rating, null);
    const saved = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) }); assert.equal(saved?.shareRating, false); assert.ok(saved?.ratingId);
  });
  it("does not broaden sharing on a draft and unpublishes safely", async () => {
    await saveJournal(request({ mediaItemId: mediaId, review: { id: reviewId, content: "Draft", status: "draft", visibility: "public", shareRating: true } }));
    assert.equal((await (await read()).json()).review.rating, null);
    await saveJournal(request({ mediaItemId: mediaId, review: { id: reviewId, content: "Draft", status: "unpublished", visibility: "public", shareRating: false } }));
    assert.equal((await read()).status, 404);
  });
  it("deletes writing without deleting the personal rating", async () => {
    const result = await deleteReview(new NextRequest(`http://localhost:3000/api/reviews/${reviewId}`, { method: "DELETE", headers: { cookie } }), { params: Promise.resolve({ id: reviewId }) });
    assert.equal(result.status, 200);
    const rating = await db.query.ratings.findFirst({ where: (r, { and, eq, isNull }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), isNull(r.collectionId)) });
    assert.equal(rating?.calculatedOverallScore, 8);
  });
});

describe("community rating eligibility and TMDB metadata", () => {
  const item = (i: number, scale = 10): CommunityRatingCandidate => ({ userId: `u${i}`, mediaItemId: "m", status: "published", visibility: "public", isJournal: true, shareRating: true, rating: { userId: `u${i}`, mediaItemId: "m", collectionId: null, tierId: null, sourceRating: null, sourceService: null, calculatedOverallScore: scale * 0.8, ratingSystemId: scale === 10 ? null : "rubric", ratingSystem: scale === 10 ? null : { scale, type: "numerical" } } });
  it("requires 10 distinct eligible users and normalizes mixed scales", () => {
    const nine = Array.from({ length: 9 }, (_, i) => item(i, i % 2 ? 5 : 100));
    assert.equal(communityAverage("m", [...nine, nine[0]]), null);
    assert.deepEqual(communityAverage("m", [...nine, item(9)]), { average: 8, count: 10 });
  });
  it("excludes unshared, nonpublic, imported, collection, tier and invalid scores", () => {
    const bad = [item(1), item(2), item(3), item(4), item(5), item(6), item(7), item(8)];
    bad[0].shareRating = false; bad[1].visibility = "unlisted"; bad[2].rating!.sourceRating = 4; bad[3].rating!.collectionId = "c"; bad[4].rating!.tierId = "t"; bad[5].rating!.calculatedOverallScore = NaN; bad[6].mediaItemId = "other"; bad[7].status = "draft";
    assert.equal(communityAverage("m", [...Array.from({ length: 9 }, (_, i) => item(i + 20)), ...bad]), null);
  });
  it("never invents TMDB scores or votes", () => {
    assert.equal(tmdbAudienceRating(null), null); assert.equal(tmdbAudienceRating({ vote_average: 0, vote_count: 0 }), null);
    assert.deepEqual(tmdbAudienceRating({ voteAverage: 7.3 }), { score: 7.3, votes: null });
    assert.deepEqual(tmdbAudienceRating({ vote_average: 7.3, vote_count: 200 }), { score: 7.3, votes: 200 });
  });
});
