/** Legacy independent reviews keep their existing explicit rating attachment behavior. */
export function canShowReviewRating(review: { isJournal: boolean; shareRating: boolean; userId: string }, viewerId?: string | null): boolean {
  return !review.isJournal || review.shareRating || review.userId === viewerId;
}

export interface CommunityRatingCandidate {
  userId: string; mediaItemId: string; status: string; visibility: string; isJournal: boolean; shareRating: boolean;
  rating: { userId: string; mediaItemId: string; collectionId: string | null; tierId: string | null; sourceRating: number | null; sourceService: string | null; calculatedOverallScore: number | null; ratingSystemId: string | null; ratingSystem: { scale: number; type: string } | null; categoryScores?: readonly unknown[] } | null;
}

/** A public average requires explicit journal consent, one valid global score per person. */
export function communityAverage(mediaId: string, candidates: CommunityRatingCandidate[]): { average: number; count: number } | null {
  const scores = new Map<string, number>();
  for (const row of candidates) {
    const r = row.rating;
    if (row.mediaItemId !== mediaId || row.status !== "published" || row.visibility !== "public" || (row.isJournal && !row.shareRating) || !r || r.userId !== row.userId || r.mediaItemId !== mediaId || r.collectionId !== null || r.tierId !== null || r.sourceRating !== null || r.sourceService !== null) continue;
    if (r.ratingSystemId && (!r.ratingSystem || r.ratingSystem.type !== "numerical")) continue;
    if (!r.ratingSystemId && r.categoryScores?.length) continue; // Historical rubric scale is unknown.
    const scale = r.ratingSystemId ? r.ratingSystem!.scale : 10;
    const score = r.calculatedOverallScore;
    if (typeof score !== "number" || !Number.isFinite(score) || !Number.isFinite(scale) || scale <= 0 || score < 0 || score > scale) continue;
    if (!scores.has(row.userId)) scores.set(row.userId, score / scale * 10);
  }
  if (scores.size < 10) return null;
  return { average: Math.round([...scores.values()].reduce((a, b) => a + b, 0) / scores.size * 10) / 10, count: scores.size };
}

export function tmdbAudienceRating(metadata: unknown): { score: number; votes: number | null } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const data = metadata as Record<string, unknown>;
  const score = data.voteAverage ?? data.vote_average;
  const votes = data.voteCount ?? data.vote_count;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 10) return null;
  if (typeof votes === "number" && (!Number.isFinite(votes) || votes <= 0)) return null;
  return { score, votes: typeof votes === "number" && Number.isInteger(votes) && votes > 0 ? votes : null };
}
