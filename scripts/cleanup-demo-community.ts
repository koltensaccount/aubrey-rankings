import fs from "node:fs";
import path from "node:path";
import { db, pool } from "../src/db";
import {
  user,
  collections,
  collectionEntries,
  ratings,
  categoryScores,
  follows,
  likes,
  comments,
  notifications,
  savedRankings,
  feedActivities,
} from "../src/db/schema";
import { inArray, sql } from "drizzle-orm";

const CREDENTIALS_DIR = path.join(process.env.HOME || "", ".aubrey-rankings");
const MANIFEST_FILE = path.join(CREDENTIALS_DIR, "demo-manifest.json");

/**
 * CAUTION: This script cleanly purges ONLY the dedicated prototype demo cohort
 * identified in demo-manifest.json or having usernames in DEMO_USERNAMES.
 *
 * DO NOT execute without explicit user approval.
 */
const DEMO_USERNAMES = ["demo_aubrey", "demo_julian", "demo_marcus", "demo_elena"];

(async () => {
  console.log("=== Aubrey Rankings: Demo Cohort Cleanup Inspection ===");

  // Find demo users in the database
  const demoUsers = await db
    .select({ id: user.id, username: user.username, email: user.email })
    .from(user)
    .where(inArray(user.username, DEMO_USERNAMES));

  if (demoUsers.length === 0) {
    console.log("No demo users found in the database. Nothing to clean up.");
    await pool.end();
    return;
  }

  const demoUserIds = demoUsers.map((u) => u.id);
  console.log(`Identified ${demoUsers.length} demo users for cleanup:`);
  for (const u of demoUsers) {
    console.log(`  - ${u.username} (${u.email}) [ID: ${u.id}]`);
  }

  // Safety confirmation required
  if (process.env.CONFIRM_DEMO_CLEANUP !== "YES_PURGE_DEMO_COHORT") {
    console.warn("\nSAFETY GUARD ACTIVE:");
    console.warn("To execute this cleanup, you must explicitly set:");
    console.warn("  CONFIRM_DEMO_CLEANUP=YES_PURGE_DEMO_COHORT npx tsx scripts/cleanup-demo-community.ts\n");
    await pool.end();
    return;
  }

  console.log("\nExecuting targeted cleanup of demo cohort...");

  // 1. Remove notifications associated with demo users
  await db.delete(notifications).where(
    sql`${notifications.recipientUserId} IN ${demoUserIds} OR ${notifications.actorUserId} IN ${demoUserIds}`
  );

  // 2. Remove saved rankings
  await db.delete(savedRankings).where(
    sql`${savedRankings.userId} IN ${demoUserIds}`
  );

  // 3. Remove follows
  await db.delete(follows).where(
    sql`${follows.followerId} IN ${demoUserIds} OR ${follows.followingId} IN ${demoUserIds}`
  );

  // 4. Remove comments
  await db.delete(comments).where(inArray(comments.userId, demoUserIds));

  // 5. Remove likes
  await db.delete(likes).where(inArray(likes.userId, demoUserIds));

  // 6. Remove feed activities
  await db.delete(feedActivities).where(inArray(feedActivities.userId, demoUserIds));

  // 7. Find collections owned by demo users
  const demoCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(inArray(collections.userId, demoUserIds));
  const demoColIds = demoCollections.map((c) => c.id);

  if (demoColIds.length > 0) {
    await db.delete(savedRankings).where(inArray(savedRankings.collectionId, demoColIds));
    await db.delete(likes).where(inArray(likes.collectionId, demoColIds));
    await db.delete(comments).where(inArray(comments.collectionId, demoColIds));
    await db.delete(collectionEntries).where(inArray(collectionEntries.collectionId, demoColIds));
    await db.delete(ratings).where(inArray(ratings.collectionId, demoColIds));
    await db.delete(collections).where(inArray(collections.id, demoColIds));
  }

  // 8. Delete demo ratings
  await db.delete(ratings).where(inArray(ratings.userId, demoUserIds));

  // 9. Delete demo user accounts
  await db.delete(user).where(inArray(user.id, demoUserIds));

  console.log("Cleanup completed successfully. Only the demo cohort was removed.");
  await pool.end();
})().catch((err) => {
  console.error("Cleanup error:", err);
  process.exitCode = 1;
});
