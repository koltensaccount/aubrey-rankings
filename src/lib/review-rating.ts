/** Legacy independent reviews keep their existing explicit rating attachment behavior. */
export function canShowReviewRating(review: { isJournal: boolean; shareRating: boolean; userId: string }, viewerId?: string | null): boolean {
  return !review.isJournal || review.shareRating || review.userId === viewerId;
}

/** Present only scores whose scale can be established from their saved metadata. */
export function reviewScoreOnTen(rating: {
  calculatedOverallScore: number | null; sourceRating: number | null; sourceScale: number | null;
  sourceService: string | null; ratingSystemId: string | null; tierId: string | null;
  ratingSystem: { scale: number; type: string } | null; categoryScores: readonly unknown[];
}): number | null {
  if (rating.tierId) return null;
  let score: number | null = null;
  let scale: number | null = null;
  if (rating.calculatedOverallScore !== null && rating.ratingSystemId && rating.ratingSystem?.type === "numerical") {
    score = rating.calculatedOverallScore;
    scale = rating.ratingSystem.scale;
  } else if (rating.calculatedOverallScore !== null && !rating.ratingSystemId && !rating.categoryScores.length && rating.sourceRating === null && rating.sourceService === null) {
    // Global quick scores are saved on a ten-point scale.
    score = rating.calculatedOverallScore;
    scale = 10;
  } else if (rating.sourceRating !== null) {
    score = rating.sourceRating;
    scale = rating.sourceScale;
  }
  if (score === null || scale === null || !Number.isFinite(score) || !Number.isFinite(scale) || scale <= 0 || score < 0 || score > scale) return null;
  return score / scale * 10;
}

export interface CommunityRatingCandidate {
  id?: string;
  userId: string;
  mediaItemId: string;
  status: string;
  visibility: string;
  isJournal?: boolean;
  shareRating?: boolean;
  ratingValue?: number | null;
  sourceRating?: number | null;
  sourceScale?: number | null;
  sourceService?: string | null;
  rating?: {
    userId: string;
    mediaItemId: string;
    collectionId: string | null;
    tierId: string | null;
    sourceRating: number | null;
    sourceScale?: number | null;
    sourceService: string | null;
    calculatedOverallScore: number | null;
    ratingSystemId: string | null;
    ratingSystem: { scale: number; type: string } | null;
    categoryScores?: readonly unknown[];
  } | null;
}

export interface RatingDistributionBucket {
  stars: number;
  count: number;
  percentage: number;
}

export interface CommunityAverageResult {
  average: number;
  starsAverage: number;
  count: number;
  distribution: {
    buckets: RatingDistributionBucket[];
    countsByStar: Record<number, number>;
  };
}

/** Resolves an eligible review's authoritative 10-point score across direct, imported, or linked ratings. */
export function resolveReviewScoreOnTen(row: {
  userId?: string;
  mediaItemId?: string;
  isJournal?: boolean;
  shareRating?: boolean;
  ratingValue?: number | null;
  sourceRating?: number | null;
  sourceScale?: number | null;
  sourceService?: string | null;
  rating?: {
    userId?: string;
    mediaItemId?: string;
    collectionId?: string | null;
    tierId?: string | null;
    sourceRating?: number | null;
    sourceScale?: number | null;
    sourceService?: string | null;
    calculatedOverallScore?: number | null;
    ratingSystemId?: string | null;
    ratingSystem?: { scale: number; type: string } | null;
    categoryScores?: readonly unknown[];
  } | null;
}): number | null {
  if (row.isJournal && row.shareRating === false) return null;

  // 1. Linked rating
  const r = row.rating;
  if (r) {
    const isMismatched = Boolean(
      (r.userId && row.userId && r.userId !== row.userId) ||
      (r.mediaItemId && row.mediaItemId && r.mediaItemId !== row.mediaItemId) ||
      r.collectionId !== null ||
      r.tierId !== null
    );

    if (!isMismatched) {
      if (
        !(!r.ratingSystemId && r.categoryScores?.length) &&
        !(r.ratingSystemId && (!r.ratingSystem || r.ratingSystem.type !== "numerical"))
      ) {
        const s = reviewScoreOnTen({
          calculatedOverallScore: r.calculatedOverallScore ?? null,
          sourceRating: r.sourceRating ?? null,
          sourceScale: r.sourceScale ?? null,
          sourceService: r.sourceService ?? null,
          ratingSystemId: r.ratingSystemId ?? null,
          tierId: r.tierId ?? null,
          ratingSystem: r.ratingSystem ?? null,
          categoryScores: r.categoryScores ?? [],
        });
        if (typeof s === "number" && Number.isFinite(s) && s >= 0 && s <= 10) {
          return s;
        }
      }
    }
  }

  // 2. Direct review-level ratingValue (0-10)
  if (typeof row.ratingValue === "number" && Number.isFinite(row.ratingValue)) {
    if (row.ratingValue >= 0 && row.ratingValue <= 10) {
      return row.ratingValue;
    }
  }

  // 3. Direct review-level sourceRating (e.g. Letterboxd 0.5-5.0)
  if (typeof row.sourceRating === "number" && Number.isFinite(row.sourceRating)) {
    const scale = typeof row.sourceScale === "number" && row.sourceScale > 0 ? row.sourceScale : 5;
    if (row.sourceRating >= 0 && row.sourceRating <= scale) {
      return (row.sourceRating / scale) * 10;
    }
  }

  return null;
}

/** Computes community average and distribution across all eligible, explicitly shared public reviews. */
export function communityAverage(
  mediaId: string,
  candidates: CommunityRatingCandidate[],
  options?: { minRatings?: number; deduplicateByAccount?: boolean }
): CommunityAverageResult | null {
  const minRatings = options?.minRatings ?? 1;
  const deduplicate = options?.deduplicateByAccount ?? false;

  const scores: number[] = [];
  const seenUsers = new Set<string>();

  for (const row of candidates) {
    if (row.mediaItemId !== mediaId) continue;
    if (row.status !== "published" || row.visibility !== "public") continue;
    if (row.isJournal && row.shareRating === false) continue;

    const score = resolveReviewScoreOnTen(row);
    if (score === null || !Number.isFinite(score) || score < 0 || score > 10) continue;

    if (deduplicate) {
      if (seenUsers.has(row.userId)) continue;
      seenUsers.add(row.userId);
    }

    scores.push(score);
  }

  if (scores.length < minRatings) return null;

  const total = scores.reduce((sum, val) => sum + val, 0);
  const average = Math.round((total / scores.length) * 10) / 10;
  const starsAverage = Math.round((average / 2) * 10) / 10;

  // Build 5-star distribution buckets (1 to 5)
  const countsByStar: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of scores) {
    const starVal = s / 2;
    let starBucket: number;
    if (starVal < 1.5) starBucket = 1;
    else if (starVal < 2.5) starBucket = 2;
    else if (starVal < 3.5) starBucket = 3;
    else if (starVal < 4.5) starBucket = 4;
    else starBucket = 5;

    countsByStar[starBucket] = (countsByStar[starBucket] || 0) + 1;
  }

  const buckets: RatingDistributionBucket[] = [5, 4, 3, 2, 1].map((stars) => {
    const c = countsByStar[stars] || 0;
    return {
      stars,
      count: c,
      percentage: scores.length > 0 ? Math.round((c / scores.length) * 1000) / 10 : 0,
    };
  });

  return {
    average,
    starsAverage,
    count: scores.length,
    distribution: {
      buckets,
      countsByStar,
    },
  };
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

/** A review's own score, independent of mutable ranking/standalone ratings. */
export function personalReviewScore(review: { ratingValue?: number | null; sourceRating?: number | null; sourceScale?: number | null; score?: number | null }): number | null {
  if (typeof review.ratingValue === "number" && Number.isFinite(review.ratingValue)) return review.ratingValue;
  if (typeof review.sourceRating === "number" && Number.isFinite(review.sourceRating) && typeof review.sourceScale === "number" && review.sourceScale > 0) return review.sourceRating / review.sourceScale * 10;
  return typeof review.score === "number" && Number.isFinite(review.score) ? review.score : null;
}

export function latestDatedRatedReview<T extends { id: string; status: string; publishedAt: Date | string | null; sourceService?: string | null; sourceReviewDate?: string | null; ratingValue?: number | null; sourceRating?: number | null; sourceScale?: number | null; score?: number | null }>(items: readonly T[]): T | undefined {
  const date = (r: T) => r.sourceService === "letterboxd" ? r.sourceReviewDate || null : r.publishedAt ? new Date(r.publishedAt).toISOString() : null;
  return items.filter((r) => r.status === "published" && date(r) && personalReviewScore(r) !== null)
    .sort((a, b) => date(b)!.localeCompare(date(a)!) || b.id.localeCompare(a.id))[0];
}

export function validReviewScoreInput(input: { ratingValue?: unknown; sourceRating?: unknown; sourceScale?: unknown }): boolean {
  const { ratingValue, sourceRating, sourceScale } = input;
  if (ratingValue !== undefined && ratingValue !== null && (typeof ratingValue !== "number" || !Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 10)) return false;
  if (sourceScale !== undefined && sourceScale !== null && (typeof sourceScale !== "number" || !Number.isFinite(sourceScale) || sourceScale <= 0)) return false;
  const scale = typeof sourceScale === "number" ? sourceScale : 5;
  return sourceRating === undefined || sourceRating === null || (typeof sourceRating === "number" && Number.isFinite(sourceRating) && sourceRating >= 0 && sourceRating <= scale);
}
