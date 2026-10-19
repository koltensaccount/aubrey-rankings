import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { collectionEntries, collections, mediaItems, ratings, reviews, user } from "../db/schema";

describe("Phase 13B journal persistence", () => {
  const suffix = `${process.pid}_${Date.now()}`;
  const userId = `phase13b_user_${suffix}`;
  const mediaId = `phase13b_media_${suffix}`;
  const collectionId = `phase13b_collection_${suffix}`;

  before(async () => {
    await db.insert(user).values({ id: userId, name: "Journal tester", email: `${userId}@example.com`, username: `journal_${suffix}` });
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Journal test" });
    await db.insert(collections).values({ id: collectionId, userId, title: "Separate ranking", collectionType: "ranked" });
    await db.insert(collectionEntries).values({ id: randomUUID(), collectionId, mediaItemId: mediaId, sortOrder: 1 });
  });

  after(async () => {
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await db.delete(ratings).where(eq(ratings.userId, userId));
    await db.delete(collections).where(eq(collections.id, collectionId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("keeps a private journal review and global quick rating together without touching a collection rating", async () => {
    const globalRatingId = `rate_${suffix}`;
    const collectionRatingId = `rate_collection_${suffix}`;
    const journalId = `review_${suffix}`;
    await db.insert(ratings).values([
      { id: globalRatingId, userId, mediaItemId: mediaId, calculatedOverallScore: 8.5, isWatched: true },
      { id: collectionRatingId, userId, mediaItemId: mediaId, collectionId, calculatedOverallScore: 3, isWatched: true },
    ]);
    await db.insert(reviews).values({
      id: journalId, userId, mediaItemId: mediaId, ratingId: globalRatingId, isJournal: true,
      content: "A private thought.", contentFormat: "markdown", status: "published", visibility: "private",
    });
    const journal = await db.query.reviews.findFirst({ where: (r, { and, eq }) => and(eq(r.id, journalId), eq(r.isJournal, true)) });
    const global = await db.query.ratings.findFirst({ where: (r, { and, eq, isNull }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), isNull(r.collectionId)) });
    const ranked = await db.query.ratings.findFirst({ where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), eq(r.collectionId, collectionId)) });
    assert.equal(journal?.visibility, "private");
    assert.equal(journal?.ratingId, globalRatingId);
    assert.equal(global?.calculatedOverallScore, 8.5);
    assert.equal(ranked?.calculatedOverallScore, 3);
  });

  it("allows clearing only the journal score while retaining its writing", async () => {
    const journal = await db.query.reviews.findFirst({ where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.mediaItemId, mediaId), eq(r.isJournal, true)) });
    assert.ok(journal);
    await db.delete(ratings).where(and(eq(ratings.userId, userId), eq(ratings.mediaItemId, mediaId), isNull(ratings.collectionId)));
    const retained = await db.query.reviews.findFirst({ where: (r, { eq }) => eq(r.id, journal!.id) });
    assert.equal(retained?.content, "A private thought.");
    assert.equal(retained?.ratingId, null);
  });
});
