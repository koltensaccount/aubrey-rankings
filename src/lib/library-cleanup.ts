import { db } from "@/db";
import {
  ratings,
  reviews,
  diaryEntries,
  watchlistItems,
  collections,
  collectionEntries,
  ratingSystems,
} from "@/db/schema";
import { eq, and, or, isNull, isNotNull, ne, sql, inArray } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";

const CLEANUP_SECRET = process.env.AUTH_SECRET || "aubrey_cleanup_protection_secret_2026";

export interface CleanupPreview {
  targetUserId: string;
  token: string;
  expiresAt: string;
  toRemove: {
    letterboxdDiaryEntries: number;
    letterboxdReviews: number;
    letterboxdWatchlistItems: number;
    letterboxdGlobalRatings: number;
    letterboxdCustomLists: number;
    letterboxdListEntries: number;
    totalRemovable: number;
  };
  toPreserve: {
    aubreyRankingsAndLists: number;
    aubreyCollectionEntries: number;
    collectionScopedRatings: number;
    customRubricSystems: number;
    nativeAubreyReviews: number;
    totalPreserved: number;
  };
}

export function generateCleanupToken(userId: string): { token: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
  const payload = `${userId}:${expiresAt}`;
  const signature = createHmac("sha256", CLEANUP_SECRET).update(payload).digest("hex");
  const token = Buffer.from(JSON.stringify({ userId, expiresAt, signature })).toString("base64url");
  return { token, expiresAt };
}

export function verifyCleanupToken(token: string, userId: string): boolean {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const { userId: tokenUserId, expiresAt, signature } = JSON.parse(raw);

    if (tokenUserId !== userId) return false;
    if (new Date(expiresAt).getTime() < Date.now()) return false;

    const payload = `${tokenUserId}:${expiresAt}`;
    const expectedSig = createHmac("sha256", CLEANUP_SECRET).update(payload).digest("hex");
    return signature === expectedSig;
  } catch {
    return false;
  }
}

export async function calculateCleanupPreview(userId: string): Promise<CleanupPreview> {
  const [
    diaryCount,
    letterboxdReviewsCount,
    watchlistCount,
    letterboxdGlobalRatingsCount,
    letterboxdLists,
    nativeReviewsCount,
    aubreyLists,
    collectionRatingsCount,
    rubricsCount,
  ] = await Promise.all([
    // To remove
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(eq(diaryEntries.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.sourceService, "letterboxd"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(
        and(
          eq(ratings.userId, userId),
          isNull(ratings.collectionId),
          eq(ratings.sourceService, "letterboxd")
        )
      ),
    db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.sourceService, "letterboxd"))),

    // To preserve
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          or(isNull(reviews.sourceService), ne(reviews.sourceService, "letterboxd"))
        )
      ),
    db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, userId),
          or(isNull(collections.sourceService), ne(collections.sourceService, "letterboxd"))
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(and(eq(ratings.userId, userId), isNotNull(ratings.collectionId))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratingSystems)
      .where(eq(ratingSystems.userId, userId)),
  ]);

  const letterboxdColIds = letterboxdLists.map((l) => l.id);
  let letterboxdListEntriesCount = 0;
  if (letterboxdColIds.length > 0) {
    const res = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionEntries)
      .where(inArray(collectionEntries.collectionId, letterboxdColIds));
    letterboxdListEntriesCount = res[0]?.count || 0;
  }

  const aubreyColIds = aubreyLists.map((l) => l.id);
  let aubreyCollectionEntriesCount = 0;
  if (aubreyColIds.length > 0) {
    const res = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionEntries)
      .where(inArray(collectionEntries.collectionId, aubreyColIds));
    aubreyCollectionEntriesCount = res[0]?.count || 0;
  }

  const { token, expiresAt } = generateCleanupToken(userId);

  const toRemove = {
    letterboxdDiaryEntries: diaryCount[0]?.count || 0,
    letterboxdReviews: letterboxdReviewsCount[0]?.count || 0,
    letterboxdWatchlistItems: watchlistCount[0]?.count || 0,
    letterboxdGlobalRatings: letterboxdGlobalRatingsCount[0]?.count || 0,
    letterboxdCustomLists: letterboxdLists.length,
    letterboxdListEntries: letterboxdListEntriesCount,
    totalRemovable:
      (diaryCount[0]?.count || 0) +
      (letterboxdReviewsCount[0]?.count || 0) +
      (watchlistCount[0]?.count || 0) +
      (letterboxdGlobalRatingsCount[0]?.count || 0) +
      letterboxdLists.length +
      letterboxdListEntriesCount,
  };

  const toPreserve = {
    aubreyRankingsAndLists: aubreyLists.length,
    aubreyCollectionEntries: aubreyCollectionEntriesCount,
    collectionScopedRatings: collectionRatingsCount[0]?.count || 0,
    customRubricSystems: rubricsCount[0]?.count || 0,
    nativeAubreyReviews: nativeReviewsCount[0]?.count || 0,
    totalPreserved:
      aubreyLists.length +
      aubreyCollectionEntriesCount +
      (collectionRatingsCount[0]?.count || 0) +
      (rubricsCount[0]?.count || 0) +
      (nativeReviewsCount[0]?.count || 0),
  };

  return {
    targetUserId: userId,
    token,
    expiresAt,
    toRemove,
    toPreserve,
  };
}

export async function executeCleanup(
  userId: string,
  token: string,
  options?: { dryRun?: boolean }
) {
  if (!verifyCleanupToken(token, userId)) {
    throw new Error("Invalid or expired cleanup confirmation token. Please generate a fresh preview.");
  }

  const isDryRun = Boolean(options?.dryRun);
  let dryRunDeleted: any = null;

  try {
    return await db.transaction(async (tx) => {
      // 1. Delete diary entries
      const diaryDeleted = await tx
        .delete(diaryEntries)
        .where(eq(diaryEntries.userId, userId))
        .returning({ id: diaryEntries.id });

      // 2. Delete Letterboxd reviews
      const reviewsDeleted = await tx
        .delete(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.sourceService, "letterboxd")))
        .returning({ id: reviews.id });

      // 3. Delete Letterboxd global ratings (collectionId IS NULL)
      const ratingsDeleted = await tx
        .delete(ratings)
        .where(
          and(
            eq(ratings.userId, userId),
            isNull(ratings.collectionId),
            eq(ratings.sourceService, "letterboxd")
          )
        )
        .returning({ id: ratings.id });

      // 4. Delete watchlist items
      const watchlistDeleted = await tx
        .delete(watchlistItems)
        .where(eq(watchlistItems.userId, userId))
        .returning({ id: watchlistItems.id });

      // 5. Delete Letterboxd custom lists
      const letterboxdLists = await tx.query.collections.findMany({
        where: and(eq(collections.userId, userId), eq(collections.sourceService, "letterboxd")),
        columns: { id: true },
      });
      const colIds = letterboxdLists.map((l) => l.id);
      let listEntriesDeletedCount = 0;
      if (colIds.length > 0) {
        const centries = await tx
          .delete(collectionEntries)
          .where(inArray(collectionEntries.collectionId, colIds))
          .returning({ id: collectionEntries.id });
        listEntriesDeletedCount = centries.length;

        await tx.delete(collections).where(inArray(collections.id, colIds));
      }

      dryRunDeleted = {
        diaryEntries: diaryDeleted.length,
        reviews: reviewsDeleted.length,
        ratings: ratingsDeleted.length,
        watchlistItems: watchlistDeleted.length,
        customLists: colIds.length,
        customListEntries: listEntriesDeletedCount,
      };

      if (isDryRun) {
        tx.rollback();
      }

      return {
        success: true,
        dryRun: false,
        deleted: dryRunDeleted,
      };
    });
  } catch (err: any) {
    if (isDryRun && (err?.name === "TransactionRollbackError" || err?.message === "Rollback" || String(err).includes("Rollback"))) {
      return {
        success: true,
        dryRun: true,
        deleted: dryRunDeleted,
      };
    }
    throw err;
  }
}
