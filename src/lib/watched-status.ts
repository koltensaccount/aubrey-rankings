import { db } from "@/db";
import { ratings, collectionEntries, collections } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Reconciles ranked items to ensure they idempotently count as Watched
 * in the user's global library without fabricating fake viewing events or dates.
 *
 * Invariants:
 * 1. Ranking a film implies that film is Watched.
 * 2. Ranking an individual television episode implies that exact episode is Watched (not the whole series).
 * 3. Idempotent: running multiple times never duplicates records.
 * 4. Removing an item from a ranking does not erase historical Watched status.
 */
export async function markRankedMediaAsWatched(
  userId: string,
  mediaItemId: string,
  txOrDb: any = db
): Promise<void> {
  const existingGlobal = await txOrDb.query.ratings.findFirst({
    where: (r: any, { and, eq, isNull }: any) =>
      and(
        eq(r.userId, userId),
        eq(r.mediaItemId, mediaItemId),
        isNull(r.collectionId)
      ),
  });

  if (existingGlobal) {
    if (!existingGlobal.isWatched) {
      await txOrDb
        .update(ratings)
        .set({
          isWatched: true,
          updatedAt: new Date(),
        })
        .where(eq(ratings.id, existingGlobal.id));
    }
  } else {
    // Insert new global rating row marked watched with no fake scores or dates
    await txOrDb
      .insert(ratings)
      .values({
        id: `rate_${randomUUID()}`,
        userId,
        mediaItemId,
        collectionId: null,
        isWatched: true,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

/**
 * Reconciles all items in all of a user's collections to have isWatched = true.
 */
export async function reconcileUserRankedWatchedStatus(
  userId: string,
  txOrDb: any = db
): Promise<number> {
  // Find all distinct media items in the user's collections
  const rankedItems = await txOrDb
    .select({ mediaItemId: collectionEntries.mediaItemId })
    .from(collectionEntries)
    .innerJoin(collections, eq(collectionEntries.collectionId, collections.id))
    .where(eq(collections.userId, userId));

  const uniqueMediaIds = Array.from(
    new Set(rankedItems.map((r: any) => r.mediaItemId).filter(Boolean))
  ) as string[];

  let updatedCount = 0;
  for (const mediaId of uniqueMediaIds) {
    await markRankedMediaAsWatched(userId, mediaId, txOrDb);
    updatedCount++;
  }

  return updatedCount;
}
