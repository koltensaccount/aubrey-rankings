import { db } from "@/db";
import { collections, ratings, reviews } from "@/db/schema";
import { eq, and, desc, isNotNull, isNull, inArray, or, ne } from "drizzle-orm";

export interface UnifiedPublicReview {
  id: string;
  reviewType: "independent" | "collection";
  title?: string | null;
  reviewText: string;
  isSpoiler?: boolean;
  sourceRating?: number | null;
  calculatedOverallScore?: number | null;
  tier?: { name: string; color: string } | null;
  watchDate?: Date | null;
  publishedAt?: Date | null;
  updatedAt: Date;
  reviewUrl: string;
  mediaItem: any;
}

export async function getPublicReviews(userId: string): Promise<UnifiedPublicReview[]> {
  // 1. First-class published public reviews
  const firstClass = await db.query.reviews.findMany({
    where: and(
      eq(reviews.userId, userId),
      eq(reviews.status, "published"),
      eq(reviews.visibility, "public")
    ),
    orderBy: [desc(reviews.publishedAt), desc(reviews.createdAt)],
    limit: 8,
    with: {
      mediaItem: true,
      rating: {
        columns: {
          id: true,
          calculatedOverallScore: true,
          sourceRating: true,
        },
        with: {
          tier: {
            columns: {
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  const formattedFirstClass: UnifiedPublicReview[] = firstClass.map((r) => ({
    id: r.id,
    reviewType: "independent",
    title: r.title,
    reviewText: r.content,
    isSpoiler: r.isSpoiler,
    sourceRating: r.rating?.sourceRating ?? null,
    calculatedOverallScore: r.rating?.calculatedOverallScore ?? null,
    tier: r.rating?.tier ? { name: r.rating.tier.name, color: r.rating.tier.color } : null,
    watchDate: null,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    reviewUrl: `/review/${r.id}`,
    mediaItem: r.mediaItem,
  }));

  // 2. Legacy public collection ratings with explicit sharing consent
  const publicCollections = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(eq(collections.userId, userId), eq(collections.visibility, "public")),
    );
  const ids = publicCollections.map((collection) => collection.id);

  const rawRatings =
    ids.length === 0
      ? []
      : await db.query.ratings.findMany({
          where: and(
            eq(ratings.userId, userId),
            isNotNull(ratings.reviewText),
            ne(ratings.reviewText, ""),
            eq(ratings.shareCommentary, true),
            inArray(ratings.collectionId, ids),
          ),
          columns: { personalNotes: false },
          orderBy: [desc(ratings.updatedAt)],
          limit: 8,
          with: { mediaItem: true },
        });

  const formattedRatings: UnifiedPublicReview[] = rawRatings.map((r) => ({
    id: r.id,
    reviewType: "collection",
    title: null,
    reviewText: r.reviewText || "",
    isSpoiler: false,
    sourceRating: r.sourceRating,
    calculatedOverallScore: r.calculatedOverallScore,
    tier: null,
    watchDate: r.watchDate,
    publishedAt: r.updatedAt,
    updatedAt: r.updatedAt,
    reviewUrl: r.collectionId ? `/collection/${r.collectionId}` : `/media/${r.mediaItemId}`,
    mediaItem: r.mediaItem,
  }));

  const allReviews = [...formattedFirstClass, ...formattedRatings];
  allReviews.sort((a, b) => {
    const timeA = new Date(a.publishedAt || a.updatedAt).getTime();
    const timeB = new Date(b.publishedAt || b.updatedAt).getTime();
    return timeB - timeA;
  });

  return allReviews.slice(0, 8);
}
