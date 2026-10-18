import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { db } from "../db";
import {
  user,
  collections,
  mediaItems,
  collectionEntries,
  ratings,
  categoryScores,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { seedDefaultRatingSystem } from "../lib/auth";

describe("Collection Management & Deletion Engine", () => {
  const testUserId = "del_test_user_" + Date.now();
  let defaultRsId: string;
  const mediaId1 = "del_media_1_" + Date.now();
  const mediaId2 = "del_media_2_" + Date.now();
  const collectionId = "col_del_" + Date.now();
  const entryId1 = "entry_del_1_" + Date.now();
  const entryId2 = "entry_del_2_" + Date.now();
  const ratingId = "rate_del_" + Date.now();

  before(async () => {
    // 1. Create test user
    await db.insert(user).values({
      id: testUserId,
      name: "Deletion Test User",
      email: `${testUserId}@example.com`,
    });

    // 2. Seed default rating system
    defaultRsId = await seedDefaultRatingSystem(testUserId);

    // 3. Create media items
    await db.insert(mediaItems).values([
      { id: mediaId1, title: "San Junipero", mediaType: "episode" },
      { id: mediaId2, title: "Nosedive", mediaType: "episode" },
    ]);

    // 4. Create collection
    await db.insert(collections).values({
      id: collectionId,
      userId: testUserId,
      title: "Black Mirror Best Episodes",
      collectionType: "tv_show",
      defaultRatingSystemId: defaultRsId,
    });

    // 5. Add collection entries
    await db.insert(collectionEntries).values([
      { id: entryId1, collectionId, mediaItemId: mediaId1, sortOrder: 1 },
      { id: entryId2, collectionId, mediaItemId: mediaId2, sortOrder: 2 },
    ]);

    // 6. Create rating with category scores
    await db.insert(ratings).values({
      id: ratingId,
      userId: testUserId,
      mediaItemId: mediaId1,
      collectionId,
      ratingSystemId: defaultRsId,
      calculatedOverallScore: 9.2,
      isWatched: true,
    });

    const categories = await db.query.ratingCategories.findMany({
      where: (rc, { eq }) => eq(rc.ratingSystemId, defaultRsId),
    });

    if (categories.length > 0) {
      await db.insert(categoryScores).values({
        id: `cs_${ratingId}_${categories[0].id}`,
        ratingId,
        categoryId: categories[0].id,
        score: 9.5,
        weightApplied: categories[0].weight,
      });
    }
  });

  after(async () => {
    // Cleanup user (cascades to all user data)
    await db.delete(user).where(eq(user.id, testUserId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId1));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId2));
  });

  it("1. Deleting individual rating removes score and cascades to categoryScores", async () => {
    // Verify rating exists
    const beforeRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
      with: { categoryScores: true },
    });
    assert.ok(beforeRating, "Rating must exist before deletion");
    assert.ok(beforeRating.categoryScores.length > 0, "Category scores must exist");

    // Perform deletion
    await db.delete(ratings).where(eq(ratings.id, ratingId));

    // Verify rating is deleted
    const afterRating = await db.query.ratings.findFirst({
      where: (r, { eq }) => eq(r.id, ratingId),
    });
    assert.strictEqual(afterRating, undefined, "Rating must be removed");

    // Verify category scores cascaded
    const afterScores = await db.query.categoryScores.findMany({
      where: (cs, { eq }) => eq(cs.ratingId, ratingId),
    });
    assert.strictEqual(afterScores.length, 0, "Category scores must cascade delete");
  });

  it("2. Removing an entry from a collection removes association but preserves shared mediaItem", async () => {
    // Delete entry 1
    await db.delete(collectionEntries).where(eq(collectionEntries.id, entryId1));

    // Verify entry is removed from collection
    const entryCheck = await db.query.collectionEntries.findFirst({
      where: (ce, { eq }) => eq(ce.id, entryId1),
    });
    assert.strictEqual(entryCheck, undefined, "Collection entry must be removed");

    // Verify mediaItem still exists in shared library
    const mediaCheck = await db.query.mediaItems.findFirst({
      where: (m, { eq }) => eq(m.id, mediaId1),
    });
    assert.ok(mediaCheck, "Shared mediaItem must NOT be deleted when entry is removed");
    assert.strictEqual(mediaCheck.title, "San Junipero");

    // Verify remaining entry in collection remains intact
    const remainingEntries = await db.query.collectionEntries.findMany({
      where: (ce, { eq }) => eq(ce.collectionId, collectionId),
    });
    assert.strictEqual(remainingEntries.length, 1);
    assert.strictEqual(remainingEntries[0].id, entryId2);
  });

  it("3. Deleting collection cascades to entries without removing shared media library rows", async () => {
    // Delete collection
    await db.delete(collections).where(eq(collections.id, collectionId));

    // Verify collection is deleted
    const colCheck = await db.query.collections.findFirst({
      where: (c, { eq }) => eq(c.id, collectionId),
    });
    assert.strictEqual(colCheck, undefined, "Collection must be deleted");

    // Verify entries were cascade deleted
    const entriesCheck = await db.query.collectionEntries.findMany({
      where: (ce, { eq }) => eq(ce.collectionId, collectionId),
    });
    assert.strictEqual(entriesCheck.length, 0, "All collection entries must be cascade deleted");

    // Verify mediaItem2 still exists in global media library
    const media2Check = await db.query.mediaItems.findFirst({
      where: (m, { eq }) => eq(m.id, mediaId2),
    });
    assert.ok(media2Check, "Shared mediaItem must persist for other rankings and users");
  });
});
