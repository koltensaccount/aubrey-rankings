import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const testUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost/invalid");
const hasDisposableDatabase = process.env.AUBREY_TEST_MODE === "1" && ["localhost", "127.0.0.1"].includes(testUrl.hostname) && testUrl.pathname.includes("test");
if (hasDisposableDatabase) process.env.DATABASE_URL = testUrl.toString();

const execFile = promisify(execFileCallback);

(hasDisposableDatabase ? describe : describe.skip)("packaged maintenance reconciliation runner", async () => {
  const { db, pool } = await import("../db");
  const schema = await import("../db/schema");
  const { eq, asc } = await import("drizzle-orm");
  const suffix = `${process.pid}_${Date.now()}`;
  const userId = `maintenance_runner_${suffix}`;
  const viewedMediaId = `maintenance_viewed_${suffix}`;
  const ratedMediaId = `maintenance_rated_${suffix}`;
  const watchlistMediaId = `maintenance_watchlist_${suffix}`;
  let outputDir = "";

  const activitySnapshot = async () => (await db.query.activityEvents.findMany({
    where: eq(schema.activityEvents.userId, userId),
    orderBy: [asc(schema.activityEvents.eventType), asc(schema.activityEvents.id)],
  })).map(({ eventType, eventDate, diaryEntryId, reviewId, ratingId, watchlistItemId, sourceEventKey }) => ({
    eventType, eventDate, diaryEntryId, reviewId, ratingId, watchlistItemId, sourceEventKey,
  }));

  before(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "aubrey-maintenance-runner-"));
    await db.insert(schema.user).values({ id: userId, name: "Maintenance Runner", email: `${userId}@test.local` });
    await db.insert(schema.mediaItems).values([
      { id: viewedMediaId, title: "Preserved Viewing", mediaType: "movie" },
      { id: ratedMediaId, title: "Preserved Rating", mediaType: "movie" },
      { id: watchlistMediaId, title: "Preserved Watchlist", mediaType: "movie" },
    ]);
    await db.insert(schema.ratings).values([
      { id: `rating_viewed_${suffix}`, userId, mediaItemId: viewedMediaId, sourceService: "letterboxd", sourceRating: 4, sourceScale: 5 },
      { id: `rating_standalone_${suffix}`, userId, mediaItemId: ratedMediaId, calculatedOverallScore: 8.5, isWatched: true },
    ]);
    await db.insert(schema.diaryEntries).values({
      id: `diary_${suffix}`, userId, mediaItemId: viewedMediaId, watchedDate: "2004-02-29", isRewatch: true, sourceService: "letterboxd", sourceEventKey: `diary:${suffix}`,
    });
    await db.insert(schema.reviews).values({
      id: `review_${suffix}`, userId, mediaItemId: viewedMediaId, content: "Historical writing must survive", status: "published", sourceService: "letterboxd", sourceReviewDate: null,
    });
    await db.insert(schema.watchlistItems).values({ id: `watchlist_${suffix}`, userId, mediaItemId: watchlistMediaId, notes: "Keep this note" });
    await db.insert(schema.mediaNotes).values({ id: `note_${suffix}`, userId, mediaItemId: viewedMediaId, content: "Private canonical note" });
    await execFile(process.execPath, ["scripts/build-maintenance-runner.mjs"], {
      cwd: process.cwd(), env: { ...process.env, MAINTENANCE_OUTFILE: join(outputDir, "reconcile.cjs") },
    });
  });

  after(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, viewedMediaId));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, ratedMediaId));
    await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, watchlistMediaId));
    await rm(outputDir, { recursive: true, force: true });
    await pool.end();
  });

  it("executes the bundled runner twice without changing identities, dates, or historical content", async () => {
    const runner = join(outputDir, "reconcile.cjs");
    await execFile(process.execPath, [runner, userId], { env: { ...process.env, DATABASE_URL: testUrl.toString() } });
    const first = await activitySnapshot();
    assert.deepEqual(first.map((event) => [event.eventType, event.eventDate]), [
      ["rating", null], ["review", null], ["viewing", "2004-02-29"], ["watchlist", first.find((event) => event.eventType === "watchlist")?.eventDate],
    ]);
    assert.equal((await db.query.reviews.findFirst({ where: eq(schema.reviews.id, `review_${suffix}`) }))?.content, "Historical writing must survive");
    assert.equal((await db.query.ratings.findFirst({ where: eq(schema.ratings.id, `rating_standalone_${suffix}`) }))?.calculatedOverallScore, 8.5);
    assert.equal((await db.query.mediaNotes.findFirst({ where: eq(schema.mediaNotes.id, `note_${suffix}`) }))?.content, "Private canonical note");

    await execFile(process.execPath, [runner, userId], { env: { ...process.env, DATABASE_URL: testUrl.toString() } });
    assert.deepEqual(await activitySnapshot(), first);
  });
});
