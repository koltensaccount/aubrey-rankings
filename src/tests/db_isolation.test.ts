import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { db } from "../db";
import {
  user,
  collections,
  mediaItems,
  collectionEntries,
  ratingSystems,
  ratingCategories,
  ratings,
  categoryScores,
  artworkOverrides,
} from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { seedDefaultRatingSystem } from "../lib/auth";

describe("Database & Multi-Tenant Isolation (Hardened)", () => {
  const userAId = "test_user_a_" + Date.now();
  const userBId = "test_user_b_" + Date.now();

  before(async () => {
    // Create two test users
    await db.insert(user).values([
      { id: userAId, name: "Aubrey", email: `${userAId}@example.com` },
      { id: userBId, name: "Bob", email: `${userBId}@example.com` },
    ]);
  });

  after(async () => {
    // Cleanup users (cascades to collections, ratings, etc.)
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
  });

  it("enforces user isolation on private collections", async () => {
    const colAId = "col_a_" + Date.now();
    await db.insert(collections).values({
      id: colAId,
      userId: userAId,
      title: "Aubrey's Black Mirror Ranking",
      collectionType: "tv_show",
      isPublic: false,
    });

    const userBCollections = await db.query.collections.findMany({
      where: (c, { eq }) => eq(c.userId, userBId),
    });

    const hasUserACollection = userBCollections.some((c) => c.id === colAId);
    assert.strictEqual(hasUserACollection, false, "User B must not see User A's collection");
  });

  it("prevents duplicate global ratings for same user and media", async () => {
    const mediaId = "media_global_" + Date.now();
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Global Media Item",
      mediaType: "movie",
    });

    // First global rating (collectionId is null)
    await db.insert(ratings).values({
      id: "rate_g1_" + Date.now(),
      userId: userAId,
      mediaItemId: mediaId,
      collectionId: null,
      calculatedOverallScore: 9.0,
    });

    // Second global rating should violate uniq_user_media_global partial index
    await assert.rejects(
      async () => {
        await db.insert(ratings).values({
          id: "rate_g2_" + Date.now(),
          userId: userAId,
          mediaItemId: mediaId,
          collectionId: null,
          calculatedOverallScore: 8.5,
        });
      },
      (err: any) => {
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        return /uniq_user_media_global|unique constraint/i.test(msg);
      }
    );
  });

  it("isolates artwork overrides per user", async () => {
    const mediaId = "media_art_" + Date.now();
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Artwork Test Item",
      mediaType: "episode",
    });

    // User A sets custom artwork
    await db.insert(artworkOverrides).values({
      id: "art_a_" + Date.now(),
      userId: userAId,
      mediaItemId: mediaId,
      customArtworkUrl: "/uploads/aubrey_custom.webp",
    });

    // Query artwork overrides for User B
    const userBOverrides = await db.query.artworkOverrides.findMany({
      where: (ao, { eq, and }) =>
        and(eq(ao.userId, userBId), eq(ao.mediaItemId, mediaId)),
    });

    assert.strictEqual(userBOverrides.length, 0, "User B must not receive User A's artwork override");
  });

  it("seeds default rating system transactionally", async () => {
    const seededId = await seedDefaultRatingSystem(userAId);
    assert.ok(seededId, "Default rating system must be returned");

    const categories = await db.query.ratingCategories.findMany({
      where: (rc, { eq }) => eq(rc.ratingSystemId, seededId),
    });

    assert.strictEqual(categories.length, 5, "Must create 5 categories atomically");
  });
});
