import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import { categoryScores, collectionEntries, collections, mediaItems, ratingCategories, ratingSystems, ratings, reviews, user } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { POST as saveJournal } from "../app/api/journal/route";
import { GET as getReviews, resolveMediaItem } from "../app/api/reviews/route";

describe("Phase 13B journal API", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `phase13b_api_${suffix}@example.com`;
  const mediaId = `phase13b_api_media_${suffix}`;
  const collectionId = `phase13b_api_collection_${suffix}`;
  let userId = "";
  let cookie = "";
  const request = (body: unknown, authenticated = true) => new NextRequest("http://localhost:3000/api/journal", { method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { cookie } : {}) }, body: JSON.stringify(body) });

  before(async () => {
    const response = await auth.api.signUpEmail({ body: { email, password: "Password123!@#", name: "Journal API" }, asResponse: true });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie") || "";
    const account = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    assert.ok(account); userId = account.id;
    await db.update(user).set({ username: `journal_api_${suffix}`, emailVerified: true }).where(eq(user.id, userId));
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Journal API test" });
    await db.insert(collections).values({ id: collectionId, userId, title: "Scoped ranking", collectionType: "ranked" });
    await db.insert(collectionEntries).values({ id: `entry_${suffix}`, collectionId, mediaItemId: mediaId, sortOrder: 1 });
    await db.insert(ratings).values({ id: `collection_rating_${suffix}`, userId, mediaItemId: mediaId, collectionId, calculatedOverallScore: 2 });
  });

  after(async () => {
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await db.delete(categoryScores).where(eq(categoryScores.ratingId, `collection_rating_${suffix}`));
    await db.delete(ratings).where(eq(ratings.userId, userId));
    await db.delete(ratingCategories).where(eq(ratingCategories.ratingSystemId, `system_${suffix}`));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, `system_${suffix}`));
    await db.delete(collections).where(eq(collections.id, collectionId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("saves a score-only entry without creating an empty review or changing collection data", async () => {
    const response = await saveJournal(request({ mediaItemId: mediaId, quickScore: 8.5 }));
    assert.equal(response.status, 200);
    const global = await db.query.ratings.findFirst({ where: (r, { and, eq, isNull }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), isNull(r.collectionId)) });
    const scoped = await db.query.ratings.findFirst({ where: (r, { eq }) => eq(r.id, `collection_rating_${suffix}`) });
    const emptyReview = await db.query.reviews.findFirst({ where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), eq(r.isJournal, true)) });
    assert.equal(global?.calculatedOverallScore, 8.5);
    assert.equal(scoped?.calculatedOverallScore, 2);
    assert.equal(emptyReview, undefined);
  });

  it("restores a synthetic TMDB URL to its persisted canonical media id", async () => {
    await db.update(mediaItems).set({ tmdbId: 913130, mediaType: "movie" }).where(eq(mediaItems.id, mediaId));
    assert.equal(await resolveMediaItem("tmdb-movie-913130"), mediaId);
  });

  it("rolls back a score change when the accompanying publish is invalid", async () => {
    const response = await saveJournal(request({ mediaItemId: mediaId, quickScore: 1, review: { content: "", status: "published", visibility: "public" } }));
    assert.equal(response.status, 400);
    const global = await db.query.ratings.findFirst({ where: (r, { and, eq, isNull }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), isNull(r.collectionId)) });
    assert.equal(global?.calculatedOverallScore, 8.5);
  });

  it("publishes then unpublishes private journal writing through the endpoint", async () => {
    const published = await saveJournal(request({ mediaItemId: mediaId, review: { content: "Published thought", status: "published", visibility: "public" } }));
    const created = await published.json();
    assert.equal(published.status, 200);
    const unpublished = await saveJournal(request({ mediaItemId: mediaId, review: { id: created.review.id, content: "Published thought", status: "unpublished", visibility: "public" } }));
    assert.equal(unpublished.status, 200);
    const publicResult = await getReviews(new NextRequest(`http://localhost:3000/api/reviews?mediaItemId=${mediaId}`));
    assert.equal((await publicResult.json()).reviews.length, 0);
  });

  it("preserves imported ratings and accepts a saved numerical rubric", async () => {
    const global = await db.query.ratings.findFirst({ where: (r, { and, eq, isNull }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), isNull(r.collectionId)) });
    await db.update(ratings).set({ sourceRating: 4, sourceScale: 5 }).where(eq(ratings.id, global!.id));
    assert.equal((await saveJournal(request({ mediaItemId: mediaId, quickScore: 4 }))).status, 409);
    await db.update(ratings).set({ sourceRating: null, sourceScale: null }).where(eq(ratings.id, global!.id));
    await db.insert(ratingSystems).values({ id: `system_${suffix}`, userId, name: "Journal rubric", type: "numerical", scale: 10 });
    await db.insert(ratingCategories).values({ id: `category_${suffix}`, ratingSystemId: `system_${suffix}`, name: "Craft", weight: 1, sortOrder: 1, isRequired: true });
    const response = await saveJournal(request({ mediaItemId: mediaId, detailedRating: { ratingSystemId: `system_${suffix}`, scores: { [`category_${suffix}`]: 9 } } }));
    assert.equal(response.status, 200);
    const restored = await db.query.ratings.findFirst({ where: (r, { eq }) => eq(r.id, global!.id), with: { categoryScores: true } });
    assert.equal(restored?.ratingSystemId, `system_${suffix}`);
    assert.equal(restored?.categoryScores[0]?.score, 9);
  });
});
