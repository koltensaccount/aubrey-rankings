import { db } from "@/db";
import {
  user,
  diaryEntries,
  reviews,
  ratings,
  watchlistItems,
  collectionEntries,
  collections,
  unresolvedImportItems,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { seedDefaultRatingSystem } from "@/lib/auth";

export const TEST_WORKSPACE_USER_ID = "usr_test_import_workspace";
export const TEST_WORKSPACE_EMAIL = "test-workspace@aubrey.local";

/**
 * Ensures the isolated test workspace user account exists.
 * Fails safe and guarantees isTestWorkspace is true.
 */
export async function ensureTestWorkspaceUser(): Promise<string> {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, TEST_WORKSPACE_USER_ID),
  });

  if (!existing) {
    await db.insert(user).values({
      id: TEST_WORKSPACE_USER_ID,
      name: "Import Lab Test Account",
      email: TEST_WORKSPACE_EMAIL,
      emailVerified: true,
      username: "test_workspace",
      isTestWorkspace: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await seedDefaultRatingSystem(TEST_WORKSPACE_USER_ID);
    } catch {
      // Rubric might already be seeded
    }
  } else if (!existing.isTestWorkspace) {
    await db
      .update(user)
      .set({ isTestWorkspace: true })
      .where(eq(user.id, TEST_WORKSPACE_USER_ID));
  }

  return TEST_WORKSPACE_USER_ID;
}

/**
 * Safely resets all imported and generated library data for the test workspace.
 * Refuses to reset any other user ID.
 */
export async function resetTestWorkspace(targetUserId: string = TEST_WORKSPACE_USER_ID) {
  if (targetUserId !== TEST_WORKSPACE_USER_ID) {
    throw new Error(
      "Refusing to reset non-test workspace. Target user must be usr_test_import_workspace."
    );
  }

  return await db.transaction(async (tx) => {
    // 1. Delete diary entries
    const diaryDeleted = await tx
      .delete(diaryEntries)
      .where(eq(diaryEntries.userId, targetUserId))
      .returning({ id: diaryEntries.id });

    // 2. Delete reviews
    const reviewsDeleted = await tx
      .delete(reviews)
      .where(eq(reviews.userId, targetUserId))
      .returning({ id: reviews.id });

    // 3. Delete ratings
    const ratingsDeleted = await tx
      .delete(ratings)
      .where(eq(ratings.userId, targetUserId))
      .returning({ id: ratings.id });

    // 4. Delete watchlist items
    const watchlistDeleted = await tx
      .delete(watchlistItems)
      .where(eq(watchlistItems.userId, targetUserId))
      .returning({ id: watchlistItems.id });

    // 5. Delete custom collections and entries
    const userCollections = await tx.query.collections.findMany({
      where: eq(collections.userId, targetUserId),
      columns: { id: true },
    });
    const colIds = userCollections.map((c) => c.id);
    let collectionEntriesDeletedCount = 0;
    if (colIds.length > 0) {
      const centriesDeleted = await tx
        .delete(collectionEntries)
        .where(inArray(collectionEntries.collectionId, colIds))
        .returning({ id: collectionEntries.id });
      collectionEntriesDeletedCount = centriesDeleted.length;

      await tx.delete(collections).where(inArray(collections.id, colIds));
    }

    // 6. Delete unresolved items
    const unresolvedDeleted = await tx
      .delete(unresolvedImportItems)
      .where(eq(unresolvedImportItems.userId, targetUserId))
      .returning({ id: unresolvedImportItems.id });

    return {
      diaryDeleted: diaryDeleted.length,
      reviewsDeleted: reviewsDeleted.length,
      ratingsDeleted: ratingsDeleted.length,
      watchlistDeleted: watchlistDeleted.length,
      collectionsDeleted: colIds.length,
      collectionEntriesDeleted: collectionEntriesDeletedCount,
      unresolvedDeleted: unresolvedDeleted.length,
    };
  });
}

/**
 * Retrieves aggregate entity counts for the test workspace.
 */
export async function getTestWorkspaceStats() {
  await ensureTestWorkspaceUser();

  const [
    diaryCount,
    reviewsCount,
    ratingsCount,
    watchlistCount,
    collectionsCount,
    unresolvedCount,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(diaryEntries)
      .where(eq(diaryEntries.userId, TEST_WORKSPACE_USER_ID)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.userId, TEST_WORKSPACE_USER_ID)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(eq(ratings.userId, TEST_WORKSPACE_USER_ID)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, TEST_WORKSPACE_USER_ID)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(collections)
      .where(eq(collections.userId, TEST_WORKSPACE_USER_ID)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(unresolvedImportItems)
      .where(eq(unresolvedImportItems.userId, TEST_WORKSPACE_USER_ID)),
  ]);

  return {
    diaryCount: diaryCount[0]?.count || 0,
    reviewsCount: reviewsCount[0]?.count || 0,
    ratingsCount: ratingsCount[0]?.count || 0,
    watchlistCount: watchlistCount[0]?.count || 0,
    collectionsCount: collectionsCount[0]?.count || 0,
    unresolvedCount: unresolvedCount[0]?.count || 0,
  };
}
