import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { db } from "../db";
import { mediaItems, ratings, reviews, user } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { POST as saveJournal } from "../app/api/journal/route";
import { resolveMediaItem } from "../app/api/reviews/route";

describe("Phase 13B Standalone Episode Journaling", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `phase13b_ep_${suffix}@example.com`;
  const parentShowId = `tv_testshow_${suffix}`;
  const episodeId = `tv_testshow_${suffix}_s1_e1`;
  let userId = "";
  let cookie = "";

  const request = (body: unknown, authenticated = true) =>
    new NextRequest("http://localhost:3000/api/journal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authenticated ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  before(async () => {
    const response = await auth.api.signUpEmail({
      body: { email, password: "Password123!@#", name: "Episode Journaler" },
      asResponse: true,
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie") || "";

    const account = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    assert.ok(account);
    userId = account.id;

    // Pre-insert parent show
    await db.insert(mediaItems).values({
      id: parentShowId,
      mediaType: "tv",
      title: "Test Series",
    });

    // Pre-insert episode
    await db.insert(mediaItems).values({
      id: episodeId,
      mediaType: "episode",
      title: "Pilot",
      seasonNumber: 1,
      episodeNumber: 1,
      parentMediaId: parentShowId,
    });
  });

  after(async () => {
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await db.delete(ratings).where(eq(ratings.userId, userId));
    await db.delete(mediaItems).where(eq(mediaItems.id, episodeId));
    await db.delete(mediaItems).where(eq(mediaItems.id, parentShowId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("journals an episode directly without creating a ranking or touching parent show", async () => {
    const res = await saveJournal(
      request({
        mediaItemId: episodeId,
        quickScore: 9.2,
        review: {
          title: "Incredible Pilot",
          content: "A masterpiece of world-building and character introductions.",
          status: "published",
          visibility: "private",
        },
      })
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mediaItemId, episodeId);

    // Verify rating is on episode, NOT parent show
    const epRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), eq(r.mediaItemId, episodeId), isNull(r.collectionId)),
    });
    assert.ok(epRating);
    assert.equal(epRating.calculatedOverallScore, 9.2);

    const showRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), eq(r.mediaItemId, parentShowId), isNull(r.collectionId)),
    });
    assert.equal(showRating, undefined);

    // Verify review is on episode
    const epReview = await db.query.reviews.findFirst({
      where: (rv, { and, eq }) =>
        and(eq(rv.userId, userId), eq(rv.mediaItemId, episodeId), eq(rv.isJournal, true)),
    });
    assert.ok(epReview);
    assert.equal(epReview.ratingId, epRating.id);
    assert.equal(epReview.visibility, "private");
    assert.equal(epReview.title, "Incredible Pilot");
  });

  it("updates markdown writing independently without creating duplicate journal records", async () => {
    const res = await saveJournal(
      request({
        mediaItemId: episodeId,
        review: {
          title: "Incredible Pilot (Updated)",
          content: "Revised thoughts on this stellar introduction.",
          status: "published",
          visibility: "private",
        },
      })
    );
    assert.equal(res.status, 200);

    // Check count of reviews for this user on this episode
    const allReviews = await db.query.reviews.findMany({
      where: (rv, { and, eq }) =>
        and(eq(rv.userId, userId), eq(rv.mediaItemId, episodeId), eq(rv.isJournal, true)),
    });
    assert.equal(allReviews.length, 1);
    assert.equal(allReviews[0].title, "Incredible Pilot (Updated)");

    // Rating is still intact
    const epRating = await db.query.ratings.findFirst({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), eq(r.mediaItemId, episodeId), isNull(r.collectionId)),
    });
    assert.ok(epRating);
    assert.equal(epRating.calculatedOverallScore, 9.2);
    assert.equal(allReviews[0].ratingId, epRating.id);
  });

  it("supports draft writing for an episode journal entry", async () => {
    const draftEpisodeId = `tv_testshow_${suffix}_s1_e2`;
    await db.insert(mediaItems).values({
      id: draftEpisodeId,
      mediaType: "episode",
      title: "Episode 2",
      seasonNumber: 1,
      episodeNumber: 2,
      parentMediaId: parentShowId,
    });

    const res = await saveJournal(
      request({
        mediaItemId: draftEpisodeId,
        quickScore: 7.5,
        review: {
          content: "Working on thoughts for episode 2...",
          status: "draft",
        },
      })
    );
    assert.equal(res.status, 200);

    const draftReview = await db.query.reviews.findFirst({
      where: (rv, { and, eq }) =>
        and(eq(rv.userId, userId), eq(rv.mediaItemId, draftEpisodeId), eq(rv.isJournal, true)),
    });
    assert.ok(draftReview);
    assert.equal(draftReview.status, "draft");
    assert.equal(draftReview.draftContent, "Working on thoughts for episode 2...");

    // Clean up draft episode
    await db.delete(reviews).where(eq(reviews.mediaItemId, draftEpisodeId));
    await db.delete(ratings).where(eq(ratings.mediaItemId, draftEpisodeId));
    await db.delete(mediaItems).where(eq(mediaItems.id, draftEpisodeId));
  });

  it("resolves an existing episode ID via resolveMediaItem", async () => {
    const resolved = await resolveMediaItem(episodeId);
    assert.equal(resolved, episodeId);
  });
});
