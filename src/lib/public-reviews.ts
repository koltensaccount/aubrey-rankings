import { db } from "@/db";
import { collections, ratings } from "@/db/schema";
import { eq, and, desc, isNotNull, isNull, inArray, or } from "drizzle-orm";

export async function getPublicReviews(userId: string) {
  const publicCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(eq(collections.userId, userId), eq(collections.visibility, "public")),
    );
  const ids = publicCollections.map((collection) => collection.id);
  return db.query.ratings.findMany({
    where: and(
      eq(ratings.userId, userId),
      isNotNull(ratings.reviewText),
      ids.length
        ? or(isNull(ratings.collectionId), inArray(ratings.collectionId, ids))
        : isNull(ratings.collectionId),
    ),
    columns: { personalNotes: false },
    orderBy: [desc(ratings.updatedAt)],
    limit: 8,
    with: { mediaItem: true },
  });
}
