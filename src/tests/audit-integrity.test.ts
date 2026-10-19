import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  user,
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  categoryScores,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { removeCollectionEntry } from "../lib/collection-management";
import {
  executeLetterboxdImport,
  previewLetterboxdImport,
} from "../lib/letterboxd-import";
import { getPublicReviews } from "../lib/public-reviews";
import { GET as feed } from "../app/api/social/feed/route";
import { NextRequest } from "next/server";
const suffix = randomUUID();
const owner = `audit-owner-${suffix}`,
  other = `audit-other-${suffix}`;
const mediaId = `audit-media-${suffix}`;
const colIds = ["public", "private", "unlisted"].map(
  (v) => `audit-${v}-${suffix}`,
);
const entryId = `audit-entry-${suffix}`;

describe("Independent audit: privacy and data integrity", () => {
  before(async () => {
    await db
      .insert(user)
      .values(
        [owner, other].map((id) => ({
          id,
          name: id,
          email: `${id}@example.com`,
        })),
      );
    await db
      .insert(mediaItems)
      .values({
        id: mediaId,
        title: "Audit film",
        mediaType: "movie",
        releaseDate: "1972-01-01",
      });
    await db
      .insert(collections)
      .values(
        colIds.map((id, index) => ({
          id,
          userId: owner,
          title: id,
          collectionType: "custom",
          visibility: ["public", "private", "unlisted"][index],
          isPublic: true,
        })),
      );
    await db
      .insert(collectionEntries)
      .values({ id: entryId, collectionId: colIds[0], mediaItemId: mediaId });
    await db
      .insert(ratings)
      .values(
        [...colIds, null].map((collectionId, index) => ({
          id: `audit-rate-${index}-${suffix}`,
          userId: owner,
          mediaItemId: mediaId,
          collectionId,
          reviewText: `audit-review-${index}`,
          personalNotes: "private note",
          shareCommentary: index === 0,
          calculatedOverallScore: 8,
        })),
      );
  });
  after(async () => {
    const imported = await db.query.ratings.findMany({
      where: (r, { eq }) => eq(r.userId, other),
      columns: { mediaItemId: true },
    });
    await db.delete(user).where(inArray(user.id, [owner, other]));
    await db
      .delete(mediaItems)
      .where(
        inArray(mediaItems.id, [
          mediaId,
          ...imported.map((r) => r.mediaItemId),
        ]),
      );
  });
  it("public reviews omit private/unlisted collections and personal notes", async () => {
    const reviews = await getPublicReviews(owner);
    assert.deepEqual(reviews.map((r) => r.reviewText).sort(), [
      "audit-review-0",
    ]);
    assert(reviews.every((r) => !("personalNotes" in r)));
  });
  it("anonymous discovery excludes unlisted/private rows even with the legacy public flag", async () => {
    const response = await feed(
      new NextRequest("http://localhost/api/social/feed?limit=not-a-number"),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    const ids = body.items.map((item: { id: string }) => item.id);
    assert(ids.includes(colIds[0]));
    assert(!ids.includes(colIds[1]));
    assert(!ids.includes(colIds[2]));
  });
  it("entry removal enforces ownership and removes only scoped ratings atomically", async () => {
    assert.equal(await removeCollectionEntry(other, colIds[0], entryId), null);
    assert(
      await db.query.collectionEntries.findFirst({
        where: (e, { eq }) => eq(e.id, entryId),
      }),
    );
    assert(await removeCollectionEntry(owner, colIds[0], entryId));
    const remaining = await db.query.ratings.findMany({
      where: (r, { eq }) => eq(r.userId, owner),
    });
    assert.equal(remaining.length, 3);
    assert(!remaining.some((r) => r.collectionId === colIds[0]));
    assert(remaining.some((r) => r.collectionId === null));
    assert(
      await db.query.mediaItems.findFirst({
        where: (m, { eq }) => eq(m.id, mediaId),
      }),
    );
  });
  it("import preview/execution keep remakes separate, preserve ratings, and are idempotent", async () => {
    const films = [1972, 2002].map((year) => ({
      title: `Audit remake ${suffix}`,
      year,
      letterboxdUri: `https://letterboxd.com/film/audit-${year}/`,
      rating: 4.5,
      isWatched: true,
    }));
    assert.deepEqual(await previewLetterboxdImport(other, films), {
      newCount: 2,
      existingCount: 0,
    });
    assert.deepEqual(await executeLetterboxdImport(other, films), {
      newCount: 2,
      updatedCount: 0,
    });
    const imported = await db.query.ratings.findMany({
      where: (r, { eq }) => eq(r.userId, other),
      with: { mediaItem: true },
    });
    assert.equal(new Set(imported.map((r) => r.mediaItemId)).size, 2);
    assert.deepEqual(
      imported.map((r) => r.mediaItem.releaseDate?.slice(0, 4)).sort(),
      ["1972", "2002"],
    );
    await db
      .update(ratings)
      .set({ calculatedOverallScore: 9.7, personalNotes: "keep me" })
      .where(eq(ratings.id, imported[0].id));
    assert.deepEqual(await previewLetterboxdImport(other, films), {
      newCount: 0,
      existingCount: 2,
    });
    assert.deepEqual(await executeLetterboxdImport(other, films), {
      newCount: 0,
      updatedCount: 2,
    });
    const preserved = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, imported[0].id),
    });
    assert.equal(preserved?.calculatedOverallScore, 9.7);
    assert.equal(preserved?.personalNotes, "keep me");
  });
  it("rolls back shared media inserts if a later import write fails", async () => {
    const title = `Audit rollback ${suffix}`;
    await assert.rejects(executeLetterboxdImport(`missing-user-${suffix}`, [{ title, year: 1995, letterboxdUri: "", isWatched: true }]));
    assert.equal((await db.query.mediaItems.findMany({ where: (m, { eq }) => eq(m.title, title) })).length, 0);
  });
  it("serializes concurrent imports without duplicate ratings or shared media", async () => {
    const film = { title: `Audit concurrent ${suffix}`, year: 2000, letterboxdUri: "", isWatched: true };
    const results = await Promise.all([executeLetterboxdImport(other,[film]), executeLetterboxdImport(other,[film])]);
    assert.equal(results.reduce((n,r)=>n+r.newCount,0),1);
    assert.equal(results.reduce((n,r)=>n+r.updatedCount,0),1);
    assert.equal((await db.query.mediaItems.findMany({where:(m,{eq})=>eq(m.title,film.title)})).length,1);
  });

});
