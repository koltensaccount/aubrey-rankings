import { db } from "@/db";
import {
  ratings,
  reviews,
  diaryEntries,
  watchlistItems,
  collections,
  collectionEntries,
  ratingSystems,
  unresolvedImportItems,
} from "@/db/schema";
import { eq, and, or, isNull, isNotNull, ne, sql, inArray } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Retrieves the cryptographic secret used for cleanup tokens.
 * Fails closed without any hardcoded fallback.
 */
export function getCleanupSecret(): string {
  const secret =
    process.env.CLEANUP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Cleanup secret is not configured. Operation aborted fail-closed."
    );
  }
  return secret;
}

/**
 * Explicitly verifies server-side database backup readiness before any live deletion.
 * Note: File presence alone is a readiness check, not proof of restore capability.
 * Refuses real cleanup if a verified backup cannot be verified.
 */
export async function verifyBackupReadiness(): Promise<{
  verified: boolean;
  backupPath?: string;
  message?: string;
  error?: string;
}> {
  // 1. Explicit verification override for testing / deployment pipeline
  if (process.env.AUBREY_BACKUP_VERIFIED === "true") {
    return {
      verified: true,
      backupPath: "verified_via_server_flag",
      message: "Server-side backup readiness confirmed via environment flag (readiness check only; restore validation required before production rollout)",
    };
  }

  // 2. Production backup directory inspection
  const backupDir =
    process.env.BACKUP_DIR || "/home/koltensaccount/backups/aubrey-rankings";
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ backupDir)) {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ backupDir);
      const sqlGzFiles = files.filter(
        (f) => f.startsWith("aubrey_db_") && f.endsWith(".sql.gz")
      );
      if (sqlGzFiles.length > 0) {
        sqlGzFiles.sort().reverse();
        const newest = path.join(/*turbopackIgnore: true*/ backupDir, sqlGzFiles[0]);
        const stats = fs.statSync(/*turbopackIgnore: true*/ newest);
        const hoursAgo = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        // Backup must be non-empty and taken within the last 48 hours
        if (stats.size > 0 && hoursAgo <= 48) {
          return {
            verified: true,
            backupPath: newest,
            message: `Verified backup file detected at ${path.basename(newest)} (readiness check passed; restore validation required before production rollout)`,
          };
        }
      }
    }
  } catch (err: any) {
    return {
      verified: false,
      error: `Backup directory check failed: ${err?.message}`,
    };
  }

  return {
    verified: false,
    error:
      "Server-side backup readiness could not be verified. A verified database backup file presence check is required before cleanup execution (file presence alone is a readiness check, not proof of restore).",
  };
}

export interface CleanupPreview {
  targetUserId: string;
  token: string;
  expiresAt: string;
  backupVerified: boolean;
  backupReadinessMessage?: string;
  toRemove: {
    letterboxdDiaryEntries: number;
    letterboxdReviews: number;
    letterboxdWatchlistItems: number;
    letterboxdGlobalRatings: number;
    letterboxdCustomLists: number;
    letterboxdListEntries: number;
    letterboxdUnresolvedImportItems: number;
    totalRemovable: number;
  };
  toPreserve: {
    nativeAubreyDiaryEntries: number;
    nativeAubreyReviews: number;
    aubreyRankingsAndLists: number;
    aubreyCollectionEntries: number;
    collectionScopedRatings: number;
    customRubricSystems: number;
    totalPreserved: number;
  };
}

export function generateCleanupToken(userId: string): { token: string; expiresAt: string } {
  const secret = getCleanupSecret();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
  const payload = `${userId}:${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(JSON.stringify({ userId, expiresAt, signature })).toString("base64url");
  return { token, expiresAt };
}

export function verifyCleanupToken(token: string, userId: string): boolean {
  try {
    const secret = getCleanupSecret();
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const { userId: tokenUserId, expiresAt, signature } = JSON.parse(raw);

    if (tokenUserId !== userId) return false;
    if (new Date(expiresAt).getTime() < Date.now()) return false;

    const payload = `${tokenUserId}:${expiresAt}`;
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");
    return signature === expectedSig;
  } catch {
    return false;
  }
}

export async function calculateCleanupPreview(userId: string): Promise<CleanupPreview> {
  const [
    letterboxdDiaryCount,
    nativeDiaryCount,
    letterboxdReviewsCount,
    nativeReviewsCount,
    watchlistCount,
    letterboxdGlobalRatingsCount,
    letterboxdLists,
    aubreyLists,
    collectionRatingsCount,
    rubricsCount,
    letterboxdUnresolvedCount,
    backupCheck,
  ] = await Promise.all([
    // To remove: Letterboxd-only diary entries
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, userId),
          eq(diaryEntries.sourceService, "letterboxd")
        )
      ),
    // To preserve: Native Aubrey diary entries
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(
        and(
          eq(diaryEntries.userId, userId),
          or(isNull(diaryEntries.sourceService), ne(diaryEntries.sourceService, "letterboxd"))
        )
      ),
    // To remove: Letterboxd reviews
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          eq(reviews.sourceService, "letterboxd")
        )
      ),
    // To preserve: Native Aubrey reviews
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          or(isNull(reviews.sourceService), ne(reviews.sourceService, "letterboxd"))
        )
      ),
    // Watchlist items
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId)),
    // To remove: Letterboxd global ratings (collectionId IS NULL)
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
    // To remove: Letterboxd custom lists
    db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, userId),
          eq(collections.sourceService, "letterboxd")
        )
      ),
    // To preserve: Aubrey lists / rankings
    db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, userId),
          or(isNull(collections.sourceService), ne(collections.sourceService, "letterboxd"))
        )
      ),
    // To preserve: Collection-scoped ratings
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(and(eq(ratings.userId, userId), isNotNull(ratings.collectionId))),
    // To preserve: Rubric systems
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratingSystems)
      .where(eq(ratingSystems.userId, userId)),
    // To remove: Letterboxd unresolved import items
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(unresolvedImportItems)
      .where(
        and(
          eq(unresolvedImportItems.userId, userId),
          eq(unresolvedImportItems.sourceService, "letterboxd")
        )
      ),
    // Backup readiness
    verifyBackupReadiness(),
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
    letterboxdDiaryEntries: letterboxdDiaryCount[0]?.count || 0,
    letterboxdReviews: letterboxdReviewsCount[0]?.count || 0,
    letterboxdWatchlistItems: watchlistCount[0]?.count || 0,
    letterboxdGlobalRatings: letterboxdGlobalRatingsCount[0]?.count || 0,
    letterboxdCustomLists: letterboxdLists.length,
    letterboxdListEntries: letterboxdListEntriesCount,
    letterboxdUnresolvedImportItems: letterboxdUnresolvedCount[0]?.count || 0,
    totalRemovable:
      (letterboxdDiaryCount[0]?.count || 0) +
      (letterboxdReviewsCount[0]?.count || 0) +
      (watchlistCount[0]?.count || 0) +
      (letterboxdGlobalRatingsCount[0]?.count || 0) +
      letterboxdLists.length +
      letterboxdListEntriesCount +
      (letterboxdUnresolvedCount[0]?.count || 0),
  };

  const toPreserve = {
    nativeAubreyDiaryEntries: nativeDiaryCount[0]?.count || 0,
    nativeAubreyReviews: nativeReviewsCount[0]?.count || 0,
    aubreyRankingsAndLists: aubreyLists.length,
    aubreyCollectionEntries: aubreyCollectionEntriesCount,
    collectionScopedRatings: collectionRatingsCount[0]?.count || 0,
    customRubricSystems: rubricsCount[0]?.count || 0,
    totalPreserved:
      (nativeDiaryCount[0]?.count || 0) +
      (nativeReviewsCount[0]?.count || 0) +
      aubreyLists.length +
      aubreyCollectionEntriesCount +
      (collectionRatingsCount[0]?.count || 0) +
      (rubricsCount[0]?.count || 0),
  };

  return {
    targetUserId: userId,
    token,
    expiresAt,
    backupVerified: backupCheck.verified,
    backupReadinessMessage: backupCheck.verified
      ? backupCheck.message || "Verified backup file detected on server (readiness check passed; restore validation required before production rollout)"
      : backupCheck.error || "Server-side backup readiness could not be verified (file presence alone is a readiness check, not proof of restore).",
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

  // Safeguard 1: Production dry-run restriction
  if (
    !isDryRun &&
    process.env.NODE_ENV === "production" &&
    process.env.AUBREY_ALLOW_PRODUCTION_CLEANUP !== "true"
  ) {
    throw new Error(
      "Production cleanup execution is currently disabled pending separate authorization. Operations must remain dry-run only."
    );
  }

  // Safeguard 2: Server-side backup readiness verification
  if (!isDryRun) {
    const backupCheck = await verifyBackupReadiness();
    if (!backupCheck.verified) {
      throw new Error(
        `Live cleanup execution refused: ${backupCheck.error || "Backup readiness could not be verified."}`
      );
    }
  }

  let dryRunDeleted: any = null;

  try {
    return await db.transaction(async (tx) => {
      // 1. Delete ONLY Letterboxd diary entries (Preserving native Aubrey diary viewings!)
      const diaryDeleted = await tx
        .delete(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, userId),
            eq(diaryEntries.sourceService, "letterboxd")
          )
        )
        .returning({ id: diaryEntries.id });

      // 2. Delete Letterboxd reviews
      const reviewsDeleted = await tx
        .delete(reviews)
        .where(
          and(
            eq(reviews.userId, userId),
            eq(reviews.sourceService, "letterboxd")
          )
        )
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

      // 6. Delete Letterboxd unresolved import items (quarantined import records)
      const unresolvedDeleted = await tx
        .delete(unresolvedImportItems)
        .where(
          and(
            eq(unresolvedImportItems.userId, userId),
            eq(unresolvedImportItems.sourceService, "letterboxd")
          )
        )
        .returning({ id: unresolvedImportItems.id });

      dryRunDeleted = {
        diaryEntries: diaryDeleted.length,
        reviews: reviewsDeleted.length,
        ratings: ratingsDeleted.length,
        watchlistItems: watchlistDeleted.length,
        customLists: colIds.length,
        customListEntries: listEntriesDeletedCount,
        unresolvedImportItems: unresolvedDeleted.length,
        totalRemovable:
          diaryDeleted.length +
          reviewsDeleted.length +
          ratingsDeleted.length +
          watchlistDeleted.length +
          colIds.length +
          listEntriesDeletedCount +
          unresolvedDeleted.length,
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
