import { db } from "@/db";
import { collections, collectionEntries, ratings } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Delete only an owner's collection association and its scoped rating; never shared media/global ratings. */
export async function removeCollectionEntry(
  userId: string,
  collectionId: string,
  entryId: string,
) {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(eq(collections.id, collectionId), eq(collections.userId, userId)),
      )
      .for("update");
    if (!collection) return null;
    const [entry] = await tx
      .delete(collectionEntries)
      .where(
        and(
          eq(collectionEntries.id, entryId),
          eq(collectionEntries.collectionId, collectionId),
        ),
      )
      .returning();
    if (!entry) return null;
    await tx
      .delete(ratings)
      .where(
        and(
          eq(ratings.collectionId, collectionId),
          eq(ratings.userId, userId),
          eq(ratings.mediaItemId, entry.mediaItemId),
        ),
      );
    return entry;
  });
}
