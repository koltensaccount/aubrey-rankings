/**
 * Aubrey Rankings: Canon Comparison & Disagreement Analytics
 * Evaluates ranking alignment, Spearman correlation, and category divergence.
 */

export interface ComparisonItem {
  mediaItemId: string;
  title: string;
  rank: number; // 1-indexed rank within the collection
  score: number | null;
  posterPath?: string | null;
  stillPath?: string | null;
}

export interface ComparisonMetrics {
  overlappingCount: number;
  leftTotalCount: number;
  rightTotalCount: number;
  spearmanCorrelation: number | null; // -1.0 to 1.0 (null if < 2 overlapping)
  meanScoreDifference: number | null; // Mean absolute score disparity (0 to 10)
  concordancePercentage: number | null; // % of pairs where relative order agrees
  alignmentRating: "Identical" | "Strong Alignment" | "Moderate Divergence" | "Sharp Dispute" | "Polar Opposites" | "Insufficient Data";
  divergentItems: Array<{
    mediaItemId: string;
    title: string;
    leftRank: number;
    rightRank: number;
    rankDelta: number; // positive = higher on left, negative = higher on right
    leftScore: number | null;
    rightScore: number | null;
    scoreDelta: number | null;
    posterPath?: string | null;
    stillPath?: string | null;
  }>;
  concordantItems: Array<{
    mediaItemId: string;
    title: string;
    leftRank: number;
    rightRank: number;
    leftScore: number | null;
    rightScore: number | null;
    posterPath?: string | null;
    stillPath?: string | null;
  }>;
}

/**
 * Compares two ordered ranking sets and computes rigorous statistical alignment metrics.
 */
export function compareRankings(
  leftItems: ComparisonItem[],
  rightItems: ComparisonItem[]
): ComparisonMetrics {
  const rightMap = new Map<string, ComparisonItem>();
  for (const item of rightItems) {
    rightMap.set(item.mediaItemId, item);
  }

  // Find overlapping items
  const overlaps: Array<{
    left: ComparisonItem;
    right: ComparisonItem;
  }> = [];

  for (const left of leftItems) {
    const right = rightMap.get(left.mediaItemId);
    if (right) {
      overlaps.push({ left, right });
    }
  }

  const n = overlaps.length;
  if (n === 0) {
    return {
      overlappingCount: 0,
      leftTotalCount: leftItems.length,
      rightTotalCount: rightItems.length,
      spearmanCorrelation: null,
      meanScoreDifference: null,
      concordancePercentage: null,
      alignmentRating: "Insufficient Data",
      divergentItems: [],
      concordantItems: [],
    };
  }

  // 1. Spearman Rank Correlation on overlapping items
  // Re-rank items within the overlapping subset to compute true Spearman rho
  const leftSorted = [...overlaps].sort((a, b) => a.left.rank - b.left.rank);
  const leftSubRanks = new Map<string, number>();
  leftSorted.forEach((pair, idx) => leftSubRanks.set(pair.left.mediaItemId, idx + 1));

  const rightSorted = [...overlaps].sort((a, b) => a.right.rank - b.right.rank);
  const rightSubRanks = new Map<string, number>();
  rightSorted.forEach((pair, idx) => rightSubRanks.set(pair.right.mediaItemId, idx + 1));

  let sumD2 = 0;
  for (const pair of overlaps) {
    const r1 = leftSubRanks.get(pair.left.mediaItemId)!;
    const r2 = rightSubRanks.get(pair.right.mediaItemId)!;
    const d = r1 - r2;
    sumD2 += d * d;
  }

  let spearman: number | null = null;
  if (n >= 2) {
    const rawSpearman = 1 - (6 * sumD2) / (n * (n * n - 1));
    spearman = Math.round(Math.max(-1, Math.min(1, rawSpearman)) * 100) / 100;
  }

  // 2. Mean Score Difference (for items where both critics gave a score)
  let scoreDiffSum = 0;
  let scoredBothCount = 0;
  for (const pair of overlaps) {
    if (pair.left.score !== null && pair.right.score !== null) {
      scoreDiffSum += Math.abs(pair.left.score - pair.right.score);
      scoredBothCount++;
    }
  }
  const meanScoreDifference =
    scoredBothCount > 0
      ? Math.round((scoreDiffSum / scoredBothCount) * 10) / 10
      : null;

  // 3. Concordance Percentage (Pairwise order agreement)
  let concordantPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < overlaps.length; i++) {
    for (let j = i + 1; j < overlaps.length; j++) {
      const a = overlaps[i];
      const b = overlaps[j];
      const leftOrder = a.left.rank - b.left.rank;
      const rightOrder = a.right.rank - b.right.rank;

      if (leftOrder !== 0 && rightOrder !== 0) {
        totalPairs++;
        if ((leftOrder > 0 && rightOrder > 0) || (leftOrder < 0 && rightOrder < 0)) {
          concordantPairs++;
        }
      }
    }
  }

  const concordancePercentage =
    totalPairs > 0
      ? Math.round((concordantPairs / totalPairs) * 100)
      : null;

  // 4. Detailed item delta breakdown
  const analyzedItems = overlaps.map((pair) => {
    const rankDelta = pair.right.rank - pair.left.rank; // positive: left placed it higher (lower number rank)
    const scoreDelta =
      pair.left.score !== null && pair.right.score !== null
        ? Math.round((pair.left.score - pair.right.score) * 10) / 10
        : null;

    return {
      mediaItemId: pair.left.mediaItemId,
      title: pair.left.title,
      leftRank: pair.left.rank,
      rightRank: pair.right.rank,
      rankDelta,
      leftScore: pair.left.score,
      rightScore: pair.right.score,
      scoreDelta,
      posterPath: pair.left.posterPath || pair.right.posterPath,
      stillPath: pair.left.stillPath || pair.right.stillPath,
    };
  });

  // Divergent items: highest absolute rank delta first
  const divergentItems = [...analyzedItems].sort(
    (a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)
  );

  // Concordant items: closest rank alignment first
  const concordantItems = [...analyzedItems].sort(
    (a, b) => Math.abs(a.rankDelta) - Math.abs(b.rankDelta)
  );

  // 5. Qualitative Alignment Rating
  let alignmentRating: ComparisonMetrics["alignmentRating"] = "Moderate Divergence";
  if (spearman === null || n < 3) {
    alignmentRating = "Insufficient Data";
  } else if (spearman >= 0.95) {
    alignmentRating = "Identical";
  } else if (spearman >= 0.7) {
    alignmentRating = "Strong Alignment";
  } else if (spearman >= 0.3) {
    alignmentRating = "Moderate Divergence";
  } else if (spearman >= -0.2) {
    alignmentRating = "Sharp Dispute";
  } else {
    alignmentRating = "Polar Opposites";
  }

  return {
    overlappingCount: n,
    leftTotalCount: leftItems.length,
    rightTotalCount: rightItems.length,
    spearmanCorrelation: spearman,
    meanScoreDifference,
    concordancePercentage,
    alignmentRating,
    divergentItems,
    concordantItems,
  };
}
