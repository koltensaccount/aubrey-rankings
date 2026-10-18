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
