import { db } from "@/db";
import { communityAverage, type CommunityAverageResult } from "@/lib/review-rating";

export type { CommunityAverageResult };

export async function getCommunityAverage(
  mediaId: string,
  blockedUserIds: Set<string> = new Set()
): Promise<CommunityAverageResult | null> {
  const rows = await db.query.reviews.findMany({
    where: (r, { and, eq }) => and(eq(r.mediaItemId, mediaId), eq(r.status, "published"), eq(r.visibility, "public")),
    orderBy: (r, { desc }) => [desc(r.updatedAt), desc(r.id)],
    with: { rating: { with: { ratingSystem: true, categoryScores: true } } },
  });
  return communityAverage(mediaId, rows.filter((row) => !blockedUserIds.has(row.userId)));
}
