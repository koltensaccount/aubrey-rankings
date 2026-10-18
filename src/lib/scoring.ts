export interface CategoryDef {
  id: string;
  name: string;
  weight: number;
  isRequired?: boolean;
}

export interface ScoreInput {
  categoryId: string;
  score: number | null | undefined;
}

export interface CalculationResult {
  weightedScore: number | null;
  totalApplicableWeight: number;
  totalScoredCategories: number;
  totalRequiredCategories: number;
  isComplete: boolean;
}

/**
 * Calculates weighted average based on formula:
 * weighted_average = sum(category_score * category_weight) / sum(applicable_category_weights)
 *
 * Rules:
 * 1. Only categories with valid numerical scores are included in the applicable weight sum.
 * 2. If applicable weight is 0 (or no categories scored), returns null.
 * 3. Supports decimal weights and scores.
 * 4. Checks completeness against required categories.
 */
export function calculateWeightedAverage(
  categories: CategoryDef[],
  scores: Record<string, number | null | undefined>
): CalculationResult {
  let weightedSum = 0;
  let totalApplicableWeight = 0;
  let totalScoredCategories = 0;
  let totalRequiredCategories = 0;
  let scoredRequiredCount = 0;

  for (const cat of categories) {
    if (cat.isRequired) {
      totalRequiredCategories++;
    }

    const val = scores[cat.id];
    if (val !== null && val !== undefined && typeof val === "number" && Number.isFinite(val)) {
      totalScoredCategories++;
      if (cat.isRequired) {
        scoredRequiredCount++;
      }

      const weight = Number.isFinite(cat.weight) ? Math.max(0, cat.weight) : 0;
      if (weight > 0) {
        weightedSum += val * weight;
        totalApplicableWeight += weight;
      }
    }
  }

  const weightedScore =
    totalApplicableWeight > 0
      ? Math.round((weightedSum / totalApplicableWeight) * 100) / 100
      : null;

  const isComplete =
    totalRequiredCategories > 0
      ? scoredRequiredCount >= totalRequiredCategories
      : totalScoredCategories > 0;

  return {
    weightedScore,
    totalApplicableWeight,
    totalScoredCategories,
    totalRequiredCategories,
    isComplete,
  };
}

export type RatingState = "unrated" | "in_progress" | "rated";

export interface ItemRatingStatus {
  state: RatingState;
  score: number | null;
  scoredCount: number;
  totalCategories: number;
  requiredCount: number;
  isComplete: boolean;
  statusLabel: string;
  actionLabel: string;
}

export function getItemRatingStatus(
  categories: CategoryDef[],
  rating: {
    calculatedOverallScore?: number | null;
    categoryScores?: Array<{ categoryId: string; score: number | null }> | null;
  } | null | undefined
): ItemRatingStatus {
  const totalCategories = categories.length;
  const requiredCount = categories.filter((c) => c.isRequired).length;

  if (!rating || !rating.categoryScores || rating.categoryScores.length === 0) {
    return {
      state: "unrated",
      score: null,
      scoredCount: 0,
      totalCategories,
      requiredCount,
      isComplete: false,
      statusLabel: "Unrated",
      actionLabel: "Rate",
    };
  }

  const scoresMap: Record<string, number | null> = {};
  for (const cs of rating.categoryScores) {
    if (cs.score !== null && cs.score !== undefined && Number.isFinite(cs.score)) {
      scoresMap[cs.categoryId] = cs.score;
    }
  }

  const calc = calculateWeightedAverage(categories, scoresMap);

  if (calc.totalScoredCategories === 0) {
    return {
      state: "unrated",
      score: null,
      scoredCount: 0,
      totalCategories,
      requiredCount,
      isComplete: false,
      statusLabel: "Unrated",
      actionLabel: "Rate",
    };
  }

  if (calc.isComplete) {
    const finalScore = calc.weightedScore ?? rating.calculatedOverallScore ?? null;
    return {
      state: "rated",
      score: finalScore,
      scoredCount: calc.totalScoredCategories,
      totalCategories,
      requiredCount,
      isComplete: true,
      statusLabel: finalScore !== null ? `★ ${finalScore.toFixed(1)}` : "Rated",
      actionLabel: "Edit Rating",
    };
  }

  return {
    state: "in_progress",
    score: calc.weightedScore,
    scoredCount: calc.totalScoredCategories,
    totalCategories,
    requiredCount,
    isComplete: false,
    statusLabel: `${calc.totalScoredCategories}/${totalCategories} Rated`,
    actionLabel: "Continue Rating",
  };
}

export function getTopRankedEntries(
  entries: any[],
  ratings: any[] = []
): Array<{ entry: any; rank: number; score: number | null }> {
  const ratingsByMediaId = new Map(ratings.map((r) => [r.mediaItemId, r]));

  const scored = entries.map((entry) => {
    const r = ratingsByMediaId.get(entry.mediaItemId);
    const score = r?.calculatedOverallScore ?? r?.sourceRating ?? null;
    return {
      entry,
      score: typeof score === "number" && !isNaN(score) ? score : null,
      sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== null && b.score !== null) {
      if (b.score !== a.score) return b.score - a.score;
    }
    if (a.score !== null && b.score === null) return -1;
    if (a.score === null && b.score !== null) return 1;
    return a.sortOrder - b.sortOrder;
  });

  return scored.slice(0, 3).map((item, index) => ({
    entry: item.entry,
    rank: index + 1,
    score: item.score,
  }));
}

