import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, collections, savedRankings } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("Saved Rankings / Bookmarks System", () => {
  const user1 = `usr_sr1_${Date.now()}`;
  const user2 = `usr_sr2_${Date.now()}`;
  const user3 = `usr_sr3_${Date.now()}`;
  const pubColId = `col_sr_pub_${Date.now()}`;
  const privColId = `col_sr_priv_${Date.now()}`;

  before(async () => {
    await db.insert(user).values([
      {
        id: user1,
        name: "Curator One",
        username: `curator1_${Date.now().toString().slice(-6)}`,
        email: `${user1}@example.com`,
      },
      {
        id: user2,
        name: "Curator Two",
        username: `curator2_${Date.now().toString().slice(-6)}`,
        email: `${user2}@example.com`,
      },
      {
        id: user3,
        name: "Curator Three",
        username: `curator3_${Date.now().toString().slice(-6)}`,
        email: `${user3}@example.com`,
      },
    ]);

    await db.insert(collections).values([
      {
        id: pubColId,
        userId: user1,
        title: "Dystopian Sci-Fi Curated",
        collectionType: "custom",
        visibility: "public",
        isPublic: true,
      },
      {
        id: privColId,
        userId: user1,
        title: "Private Rough Notes",
        collectionType: "custom",
        visibility: "private",
        isPublic: false,
      },
    ]);
  });

  after(async () => {
    await db.delete(savedRankings).where(
      sql`${savedRankings.userId} IN (${user1}, ${user2}, ${user3})`
    );
    await db.delete(collections).where(
      sql`${collections.id} IN (${pubColId}, ${privColId})`
    );
    await db.delete(user).where(
      sql`${user.id} IN (${user1}, ${user2}, ${user3})`
    );
  });

  it("1. Saves a public ranking and enforces unique constraint", async () => {
    const saveId1 = randomUUID();
    await db.insert(savedRankings).values({
      id: saveId1,
      userId: user2,
      collectionId: pubColId,
    });

    const savedRecord = await db.query.savedRankings.findFirst({
      where: and(eq(savedRankings.userId, user2), eq(savedRankings.collectionId, pubColId)),
    });
    assert.ok(savedRecord, "Saved ranking record must exist");

    // Attempting to duplicate save must reject
    let dupFailed = false;
    try {
      await db.insert(savedRankings).values({
        id: randomUUID(),
        userId: user2,
        collectionId: pubColId,
      });
    } catch {
      dupFailed = true;
    }
    assert.equal(dupFailed, true, "Duplicate save must violate unique index");
  });

  it("2. Multiple users can save the same ranking independently", async () => {
    await db.insert(savedRankings).values({
      id: randomUUID(),
      userId: user3,
      collectionId: pubColId,
    });

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRankings)
      .where(eq(savedRankings.collectionId, pubColId));
    assert.equal(Number(countRes[0]?.count), 2, "Public ranking should have 2 saves");
  });

  it("3. Unsaving removes the relationship cleanly", async () => {
    await db
      .delete(savedRankings)
      .where(
        and(eq(savedRankings.userId, user2), eq(savedRankings.collectionId, pubColId))
      );

    const checkUser2 = await db.query.savedRankings.findFirst({
      where: and(eq(savedRankings.userId, user2), eq(savedRankings.collectionId, pubColId)),
    });
    assert.equal(checkUser2, undefined, "User 2 should no longer have ranking saved");

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRankings)
      .where(eq(savedRankings.collectionId, pubColId));
    assert.equal(Number(countRes[0]?.count), 1, "Remaining count should be 1");
  });

  it("4. Saved rankings cascade on collection deletion", async () => {
    // Delete the public collection
    await db.delete(collections).where(eq(collections.id, pubColId));

    const checkSaves = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRankings)
      .where(eq(savedRankings.collectionId, pubColId));
    assert.equal(Number(checkSaves[0]?.count), 0, "Saved rankings rows must cascade delete");
  });
});
