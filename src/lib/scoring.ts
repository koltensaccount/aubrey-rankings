export interface CategoryDef {
  id: string;
  name: string;
  weight: number;
  isRequired?: boolean;
}

/** Preserve the weights recorded when a score was saved, including older rubric versions. */
export function withSavedWeights<T extends CategoryDef>(categories:T[],scores:readonly {categoryId:string;weightApplied?:number|null}[] = []):T[] {
  const saved = new Map(scores.map(s=>[s.categoryId,s.weightApplied]));
  return categories.map(category => {
    const weight = saved.get(category.id);
    return typeof weight === "number" && Number.isFinite(weight) && weight >= 0 ? {...category,weight} : category;
  });
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

import { TierItem } from "./tier-system";

export interface ItemRatingStatus {
  state: RatingState;
  score: number | null;
  scoreScale?: number;
  tier?: TierItem | null;
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
    sourceRating?: number | null;
    sourceScale?: number | null;
    tierId?: string | null;
    categoryScores?: Array<{ categoryId: string; score: number | null; weightApplied?:number|null }> | null;
    ratingSystem?: { type?: string; categories?: CategoryDef[]; tiers?: TierItem[]; scale?:number } | null;
  } | null | undefined,
  defaultScale = 10,
  activeRatingSystem?: { type?: string; tiers?: TierItem[]; categories?: CategoryDef[]; scale?: number } | null
): ItemRatingStatus {
  const effectiveSystem = activeRatingSystem ?? rating?.ratingSystem;
  if (effectiveSystem?.type === "tier") {
    const tiers = effectiveSystem.tiers || [];
    if (rating?.tierId) {
      const matchedTier = tiers.find((t) => t.id === rating.tierId) || {
        id: rating.tierId,
        name: "Rated",
        color: "#FF4757",
        sortOrder: 0,
      };
      return {
        state: "rated",
        score: null,
        tier: matchedTier,
        scoredCount: 1,
        totalCategories: 1,
        requiredCount: 1,
        isComplete: true,
        statusLabel: matchedTier.name,
        actionLabel: "Edit Tier",
      };
    }
    return {
      state: "unrated",
      score: null,
      tier: null,
      scoredCount: 0,
      totalCategories: 1,
      requiredCount: 1,
      isComplete: false,
      statusLabel: "Unrated",
      actionLabel: "Assign Tier",
    };
  }

  categories = withSavedWeights(rating?.ratingSystem?.categories ?? categories, rating?.categoryScores ?? []);
  const scoreScale = rating?.ratingSystem?.scale ?? defaultScale;
  const totalCategories = categories.length;
  const requiredCount = categories.filter((c) => c.isRequired).length;

  if (rating && (!rating.categoryScores || rating.categoryScores.length === 0) && typeof rating.sourceRating === "number" && Number.isFinite(rating.sourceRating)) {
    return {state:"rated",score:rating.sourceRating,scoreScale:rating.sourceScale??5,scoredCount:0,totalCategories,requiredCount,isComplete:true,statusLabel:`★ ${rating.sourceRating.toFixed(1)}/${rating.sourceScale ?? 5}`,actionLabel:"Edit Rating"};
  }
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
      scoreScale,
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
    scoreScale,
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
      score: typeof score === "number" && Number.isFinite(score) ? score : null,
      scale: r?.calculatedOverallScore != null ? (r?.ratingSystem?.scale || 10) : (r?.sourceScale || 5),
      sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== null && b.score !== null) {
      if (b.score / b.scale !== a.score / a.scale) return b.score / b.scale - a.score / a.scale;
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


/** Summary scores use a common ten-point display scale; stored scores are untouched. */
export function getRatingSummary(ratings: Array<{calculatedOverallScore?:number|null;sourceRating?:number|null;sourceScale?:number|null;ratingSystem?:{scale?:number}|null}>) {
  const scores = ratings.flatMap(r=> {
    const value = r.calculatedOverallScore ?? r.sourceRating;
    const scale = r.calculatedOverallScore != null ? (r.ratingSystem?.scale ?? 10) : (r.sourceScale ?? 5);
    return typeof value === "number" && Number.isFinite(value) && Number.isFinite(scale) && scale>0 ? [value / scale * 10] : [];
  });
  return {ratedCount:scores.length,meanScore:scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):"—"};
}
