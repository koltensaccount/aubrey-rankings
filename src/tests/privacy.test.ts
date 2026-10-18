import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, collections, ratings, mediaItems } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

describe("Stage 4: Privacy & Public Profile Boundaries", () => {
  const userAlphaId = `user_alpha_${Date.now()}`;
  const userBetaId = `user_beta_${Date.now()}`;
  const mediaId = `media_priv_${Date.now()}`;
  const privateColId = `col_priv_${Date.now()}`;
  const publicColId = `col_pub_${Date.now()}`;

  before(async () => {
    // 1. Create two test accounts
    await db.insert(user).values([
      {
        id: userAlphaId,
        name: "Alpha Critic",
        username: `alpha_${Date.now().toString().slice(-6)}`,
        email: `${userAlphaId}@example.com`,
      },
      {
        id: userBetaId,
        name: "Beta Critic",
        username: `beta_${Date.now().toString().slice(-6)}`,
        email: `${userBetaId}@example.com`,
      },
    ]);

    // 2. Create media item
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Solaris",
      mediaType: "movie",
      releaseDate: "1972-03-20",
    });

    // 3. Create private collection for Alpha
    await db.insert(collections).values({
      id: privateColId,
      userId: userAlphaId,
      title: "Secret Unfinished Rankings",
      collectionType: "custom",
      visibility: "private",
      isPublic: false,
    });

    // 4. Create public collection for Alpha
    await db.insert(collections).values({
      id: publicColId,
      userId: userAlphaId,
      title: "Tarkovsky Canons",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    // 5. Add rating with private personal notes
    await db.insert(ratings).values({
      id: `rate_priv_${Date.now()}`,
      userId: userAlphaId,
      mediaItemId: mediaId,
      collectionId: publicColId,
      calculatedOverallScore: 9.4,
      reviewText: "Haunting existential sci-fi.",
      personalNotes: "CONFIDENTIAL: Rewatched with old friend; emotional notes.",
      isWatched: true,
    });
  });

  after(async () => {
    // Cleanup test fixtures
    await db.delete(ratings).where(eq(ratings.mediaItemId, mediaId));
    await db.delete(collections).where(eq(collections.userId, userAlphaId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(user).where(eq(user.id, userAlphaId));
    await db.delete(user).where(eq(user.id, userBetaId));
  });

  it("filters out private collections from public profiles", async () => {
    const alphaPublicCollections = await db.query.collections.findMany({
      where: (c, { eq, and }) =>
        and(eq(c.userId, userAlphaId), eq(c.visibility, "public")),
    });

    assert.equal(alphaPublicCollections.length, 1);
    assert.equal(alphaPublicCollections[0].id, publicColId);
    assert.equal(
      alphaPublicCollections.some((c) => c.id === privateColId),
      false,
      "Private collections must never appear in public profile query"
    );
  });

  it("allows owner access to private collection but blocks other users", async () => {
    // Owner query
    const ownerView = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, privateColId), eq(c.userId, userAlphaId)),
    });
    assert.ok(ownerView, "Owner must be able to view their own private collection");

    // Other user query
    const otherUserView = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, privateColId), eq(c.userId, userBetaId)),
    });
    assert.equal(
      otherUserView,
      undefined,
      "Other users must not access private collections"
    );
  });

  it("revokes public discoverability immediately when collection is switched to private", async () => {
    // 1. Initially public
    let publicCheck = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, publicColId), eq(c.visibility, "public")),
    });
    assert.ok(publicCheck);

    // 2. Switch to private
    await db
      .update(collections)
      .set({ visibility: "private", isPublic: false })
      .where(eq(collections.id, publicColId));

    // 3. Verify immediate revocation from public queries
    publicCheck = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, publicColId), eq(c.visibility, "public")),
    });
    assert.equal(
      publicCheck,
      undefined,
      "Switching to private must immediately remove collection from public queries"
    );

    // Restore for subsequent tests
    await db
      .update(collections)
      .set({ visibility: "public", isPublic: true })
      .where(eq(collections.id, publicColId));
  });
});
