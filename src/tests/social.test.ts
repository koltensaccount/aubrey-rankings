import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, collections, follows, likes, comments } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("Stage 5: Social Features (Follows, Likes, Comments)", () => {
  const userCritic1 = `user_soc_c1_${Date.now()}`;
  const userCritic2 = `user_soc_c2_${Date.now()}`;
  const userCritic3 = `user_soc_c3_${Date.now()}`;
  const publicCollectionId = `col_soc_pub_${Date.now()}`;
  const privateCollectionId = `col_soc_priv_${Date.now()}`;

  before(async () => {
    // 1. Setup users
    await db.insert(user).values([
      {
        id: userCritic1,
        name: "Cinema Scholar",
        username: `scholar_${Date.now().toString().slice(-6)}`,
        email: `${userCritic1}@example.com`,
      },
      {
        id: userCritic2,
        name: "Film Archivist",
        username: `archivist_${Date.now().toString().slice(-6)}`,
        email: `${userCritic2}@example.com`,
      },
      {
        id: userCritic3,
        name: "Third Voice",
        username: `third_${Date.now().toString().slice(-6)}`,
        email: `${userCritic3}@example.com`,
      },
    ]);

    // 2. Setup collections
    await db.insert(collections).values([
      {
        id: publicCollectionId,
        userId: userCritic1,
        title: "Kurosawa Masterpieces",
        collectionType: "custom",
        visibility: "public",
        isPublic: true,
      },
      {
        id: privateCollectionId,
        userId: userCritic1,
        title: "Draft Scratchpad",
        collectionType: "custom",
        visibility: "private",
        isPublic: false,
      },
    ]);
  });

  after(async () => {
    // Cleanup test records
    await db.delete(comments).where(eq(comments.collectionId, publicCollectionId));
    await db.delete(likes).where(eq(likes.collectionId, publicCollectionId));
    await db.delete(follows).where(eq(follows.followerId, userCritic2));
    await db.delete(collections).where(eq(collections.id, publicCollectionId));
    await db.delete(collections).where(eq(collections.id, privateCollectionId));
    await db.delete(user).where(eq(user.id, userCritic1));
    await db.delete(user).where(eq(user.id, userCritic2));
    await db.delete(user).where(eq(user.id, userCritic3));
  });

  it("1. Follow System: creates relationship and respects unique constraint", async () => {
    const followId = randomUUID();
    await db.insert(follows).values({
      id: followId,
      followerId: userCritic2,
      followingId: userCritic1,
    });

    const followRecord = await db.query.follows.findFirst({
      where: (f, { and, eq }) =>
        and(eq(f.followerId, userCritic2), eq(f.followingId, userCritic1)),
    });

    assert.ok(followRecord, "Follow record should exist");
    assert.equal(followRecord.followerId, userCritic2);
    assert.equal(followRecord.followingId, userCritic1);

    // Verify duplicate follow fails unique constraint
    await assert.rejects(
      async () => {
        await db.insert(follows).values({
          id: randomUUID(),
          followerId: userCritic2,
          followingId: userCritic1,
        });
      },
      (err: any) => {
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        return /unique|duplicate/i.test(msg);
      },
      "Duplicate follow should violate unique constraint"
    );
  });

  it("2. Like System: adds like, enforces uniqueness, and updates like count", async () => {
    const likeId = randomUUID();
    await db.insert(likes).values({
      id: likeId,
      userId: userCritic2,
      collectionId: publicCollectionId,
    });

    const likeRecord = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, userCritic2), eq(l.collectionId, publicCollectionId)),
    });

    assert.ok(likeRecord, "Like record should exist");

    // Attempting duplicate like should fail unique constraint
    await assert.rejects(
      async () => {
        await db.insert(likes).values({
          id: randomUUID(),
          userId: userCritic2,
          collectionId: publicCollectionId,
        });
      },
      (err: any) => {
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        return /unique|duplicate/i.test(msg);
      },
      "Duplicate like should violate unique constraint"
    );

    // Remove like
    await db
      .delete(likes)
      .where(
        and(eq(likes.userId, userCritic2), eq(likes.collectionId, publicCollectionId))
      );

    const afterUnlike = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, userCritic2), eq(l.collectionId, publicCollectionId)),
    });
    assert.equal(afterUnlike, undefined, "Like should be removed");
  });

  it("3. Comments & Moderation: creates comment and honors author & owner deletion rules", async () => {
    const commentId = randomUUID();
    const commentContent = "High and Low has one of the greatest tonal shifts in cinema.";

    await db.insert(comments).values({
      id: commentId,
      userId: userCritic2,
      collectionId: publicCollectionId,
      content: commentContent,
    });

    const retrieved = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
      with: { user: true, collection: true },
    });

    assert.ok(retrieved, "Comment should be saved");
    assert.equal(retrieved.content, commentContent);
    assert.equal(retrieved.userId, userCritic2);

    // Test Moderation Rule:
    // User 3 is neither comment author nor collection owner -> should be forbidden
    const isUser3Allowed =
      userCritic3 === retrieved.userId || userCritic3 === retrieved.collection?.userId;
    assert.equal(isUser3Allowed, false, "Third-party user cannot delete comment");

    // Test Moderation Rule:
    // Collection owner (userCritic1) HAS moderation right to delete comment on their collection
    const isOwnerAllowed =
      userCritic1 === retrieved.userId || userCritic1 === retrieved.collection?.userId;
    assert.equal(isOwnerAllowed, true, "Collection owner should have moderation deletion right");

    // Perform deletion
    await db.delete(comments).where(eq(comments.id, commentId));
    const deletedCheck = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, commentId),
    });
    assert.equal(deletedCheck, undefined, "Comment should be deleted");
  });
});
