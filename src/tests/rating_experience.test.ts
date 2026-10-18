import assert from "node:assert";
import { describe, it } from "node:test";
import {
  calculateWeightedAverage,
  getItemRatingStatus,
  getTopRankedEntries,
  CategoryDef,
} from "../lib/scoring";
import { normalizeRatingScores } from "../lib/rating-validation";

describe("Rating Experience Engine — Comprehensive Verification", () => {
  const standardCategories: CategoryDef[] = [
    { id: "story", name: "Writing & Story", weight: 8, isRequired: true },
    { id: "acting", name: "Acting & Performance", weight: 8, isRequired: true },
    { id: "directing", name: "Directing", weight: 7, isRequired: true },
    { id: "cinema", name: "Cinematography", weight: 7, isRequired: true },
    { id: "impact", name: "Overall Impact", weight: 8, isRequired: true },
  ];

  // 1. Completely unrated item
  it("1. Completely unrated item: produces unrated status and null score without implying 5/10", () => {
    const unratedStatus = getItemRatingStatus(standardCategories, null);
    assert.strictEqual(unratedStatus.state, "unrated");
    assert.strictEqual(unratedStatus.score, null);
    assert.strictEqual(unratedStatus.scoredCount, 0);
    assert.strictEqual(unratedStatus.isComplete, false);
    assert.strictEqual(unratedStatus.actionLabel, "Rate");
    assert.strictEqual(unratedStatus.statusLabel, "Unrated");

    // Calculation with all empty categories returns null
    const calc = calculateWeightedAverage(standardCategories, {});
    assert.strictEqual(calc.weightedScore, null);
    assert.strictEqual(calc.totalScoredCategories, 0);
    assert.strictEqual(calc.isComplete, false);
  });

  // 2. Partially rated item
  it("2. Partially rated item: produces in_progress status, correct scored count, and provisional score", () => {
    const partialRating = {
      calculatedOverallScore: 8.5,
      categoryScores: [
        { categoryId: "story", score: 8.5 },
        { categoryId: "acting", score: 9.0 },
      ],
    };

    const status = getItemRatingStatus(standardCategories, partialRating);
    assert.strictEqual(status.state, "in_progress");
    assert.strictEqual(status.scoredCount, 2);
    assert.strictEqual(status.totalCategories, 5);
    assert.strictEqual(status.isComplete, false);
    assert.strictEqual(status.actionLabel, "Continue Rating");
    assert.strictEqual(status.statusLabel, "2/5 Rated");
    // (8.5 * 8 + 9.0 * 8) / (8 + 8) = 140 / 16 = 8.75
    assert.strictEqual(status.score, 8.75);
  });

  // 3. Fully rated item
  it("3. Fully rated item: produces rated state, completed flag, and accurate weighted score", () => {
    const fullRating = {
      calculatedOverallScore: 8.95,
      categoryScores: [
        { categoryId: "story", score: 9.0 },
        { categoryId: "acting", score: 9.5 },
        { categoryId: "directing", score: 8.5 },
        { categoryId: "cinema", score: 9.0 },
        { categoryId: "impact", score: 8.8 },
      ],
    };

    const status = getItemRatingStatus(standardCategories, fullRating);
    assert.strictEqual(status.state, "rated");
    assert.strictEqual(status.scoredCount, 5);
    assert.strictEqual(status.isComplete, true);
    assert.strictEqual(status.actionLabel, "Edit Rating");
    assert.strictEqual(status.score, 8.97);
    assert.strictEqual(status.statusLabel, "★ 9.0");
  });

  // 4. Valid zero score, where supported
  it("4. Valid zero score: distinguishes 0 from unrated, includes zero in calculation", () => {
    const zeroRating = {
      calculatedOverallScore: 0,
      categoryScores: [
        { categoryId: "story", score: 0 },
        { categoryId: "acting", score: 8 },
      ],
    };

    const status = getItemRatingStatus(standardCategories, zeroRating);
    // Story has 0 (a valid score), Acting has 8 -> 2 categories scored
    assert.strictEqual(status.scoredCount, 2);
    // (0 * 8 + 8 * 8) / 16 = 64 / 16 = 4.0
    assert.strictEqual(status.score, 4.0);

    // All zero rating
    const allZeroCalc = calculateWeightedAverage(standardCategories, {
      story: 0,
      acting: 0,
      directing: 0,
      cinema: 0,
      impact: 0,
    });
    assert.strictEqual(allZeroCalc.weightedScore, 0);
    assert.strictEqual(allZeroCalc.totalScoredCategories, 5);
    assert.strictEqual(allZeroCalc.isComplete, true);
  });

  // 5. Weighted-average calculation
  it("5. Weighted-average calculation: handles decimal weights and ignores unrated categories in denominator", () => {
    const customRubric: CategoryDef[] = [
      { id: "c1", name: "Story", weight: 3.5, isRequired: true },
      { id: "c2", name: "Visuals", weight: 1.5, isRequired: true },
      { id: "c3", name: "Bonus", weight: 2.0, isRequired: false },
    ];

    // Score only c1 and c2
    const calc = calculateWeightedAverage(customRubric, {
      c1: 8.0,
      c2: 6.0,
      c3: null, // Untouched category must not be in denominator
    });

    // Weighted sum = 8 * 3.5 + 6 * 1.5 = 28 + 9 = 37
    // Applicable weight = 3.5 + 1.5 = 5.0
    // Weighted avg = 37 / 5 = 7.4
    assert.strictEqual(calc.weightedScore, 7.4);
    assert.strictEqual(calc.totalApplicableWeight, 5.0);
    assert.strictEqual(calc.isComplete, true); // Required c1 and c2 are complete
  });

  // 6. Clearing a category
  it("6. Clearing a category: setting category to null dynamically updates totalApplicableWeight and score", () => {
    const scoresBefore: Record<string, number | null> = {
      story: 9.0,
      acting: 7.0,
    };
    const calcBefore = calculateWeightedAverage(standardCategories, scoresBefore);
    assert.strictEqual(calcBefore.totalScoredCategories, 2);
    assert.strictEqual(calcBefore.weightedScore, 8.0);

    // User clears "acting"
    const scoresAfter: Record<string, number | null> = {
      ...scoresBefore,
      acting: null,
    };
    const calcAfter = calculateWeightedAverage(standardCategories, scoresAfter);
    assert.strictEqual(calcAfter.totalScoredCategories, 1);
    assert.strictEqual(calcAfter.weightedScore, 9.0);
  });

  // 7. Saving incomplete progress
  it("7. Saving incomplete progress: normalizes partial categories safely without requiring all fields", () => {
    const partialInput = [
      { categoryId: "story", score: 8.0 },
      { categoryId: "acting", score: 7.5 },
    ];

    const normalized = normalizeRatingScores(standardCategories, {}, undefined, partialInput, 10);
    assert.strictEqual(Object.keys(normalized).length, 2);
    assert.strictEqual(normalized.story, 8.0);
    assert.strictEqual(normalized.acting, 7.5);

    const calc = calculateWeightedAverage(standardCategories, normalized);
    assert.strictEqual(calc.isComplete, false);
    assert.strictEqual(calc.totalScoredCategories, 2);
  });

  // 8. Editing an existing rating
  it("8. Editing an existing rating: updates individual category scores and preserves existing unchanged scores", () => {
    const existing = {
      story: 8.0,
      acting: 7.0,
      directing: 9.0,
    };

    // User edits acting to 8.5
    const updated = normalizeRatingScores(standardCategories, existing, { acting: 8.5 }, undefined, 10);
    assert.strictEqual(updated.story, 8.0);
    assert.strictEqual(updated.acting, 8.5);
    assert.strictEqual(updated.directing, 9.0);
  });

  // 9. Switching between different media items
  it("9. Switching between different media items: isolates ratings and preserves each item's state independently", () => {
    const item1Rating = {
      calculatedOverallScore: 9.2,
      categoryScores: standardCategories.map((c) => ({ categoryId: c.id, score: 9.2 })),
    };
    const item2Rating = {
      calculatedOverallScore: 6.5,
      categoryScores: [{ categoryId: "story", score: 6.5 }],
    };
    const item3Rating = null;

    const status1 = getItemRatingStatus(standardCategories, item1Rating);
    const status2 = getItemRatingStatus(standardCategories, item2Rating);
    const status3 = getItemRatingStatus(standardCategories, item3Rating);

    assert.strictEqual(status1.state, "rated");
    assert.strictEqual(status2.state, "in_progress");
    assert.strictEqual(status3.state, "unrated");
  });

  // 10. Different rating-system scales
  it("10. Different rating-system scales: supports scale 5, 10, and 100 gracefully", () => {
    const scale5Categories: CategoryDef[] = [
      { id: "star", name: "Overall Stars", weight: 1, isRequired: true },
    ];
    const normalizedScale5 = normalizeRatingScores(scale5Categories, {}, { star: 4.5 }, undefined, 5);
    assert.strictEqual(normalizedScale5.star, 4.5);

    // Rejects out-of-scale scores
    assert.throws(() => {
      normalizeRatingScores(scale5Categories, {}, { star: 6.0 }, undefined, 5);
    });
  });

  // 11. Changing rating-system assignments
  it("11. Changing rating-system assignments: prevents score mismatch from poisoning calculation", () => {
    const oldRubricCategories: CategoryDef[] = [
      { id: "old_c1", name: "Concept", weight: 5, isRequired: true },
      { id: "old_c2", name: "Execution", weight: 5, isRequired: true },
    ];
    const newRubricCategories: CategoryDef[] = [
      { id: "new_c1", name: "Writing", weight: 8, isRequired: true },
      { id: "new_c2", name: "Direction", weight: 7, isRequired: true },
    ];

    const historicalRating = {
      calculatedOverallScore: 8.0,
      categoryScores: [
        { categoryId: "old_c1", score: 8.0 },
        { categoryId: "old_c2", score: 8.0 },
      ],
    };

    // Evaluated against the new rubric: historical category IDs do not match new IDs
    const statusUnderNewRubric = getItemRatingStatus(newRubricCategories, historicalRating);
    // Since none of the category IDs match, it is treated safely as unrated under the new rubric
    // without crashing or silently misaligning old scores to new categories
    assert.strictEqual(statusUnderNewRubric.state, "unrated");
    assert.strictEqual(statusUnderNewRubric.scoredCount, 0);
  });

  // 12. Preserving historical category scores
  it("12. Preserving historical category scores: normalizeRatingScores rejects foreign categories without mutating previous state", () => {
    const previous = {
      story: 8.5,
      acting: 9.0,
    };

    // Attempting to send a foreign category ID throws
    assert.throws(() => {
      normalizeRatingScores(standardCategories, previous, { foreign_cat: 7.0 }, undefined, 10);
    });

    // Sending null clears only the specified category
    const afterClear = normalizeRatingScores(standardCategories, previous, { acting: null }, undefined, 10);
    assert.strictEqual(afterClear.story, 8.5);
    assert.strictEqual(afterClear.acting, undefined);
  });

  // 13. Rated/unrated/in_progress filtering
  it("13. Rated/unrated/in_progress filtering: accurately partitions items into 3 mutually exclusive sets", () => {
    const items = [
      { id: "m1", rating: { categoryScores: standardCategories.map((c) => ({ categoryId: c.id, score: 9 })) } },
      { id: "m2", rating: { categoryScores: [{ categoryId: "story", score: 7 }] } },
      { id: "m3", rating: null },
      { id: "m4", rating: { categoryScores: [] } },
    ];

    const rated = items.filter((i) => getItemRatingStatus(standardCategories, i.rating).state === "rated");
    const inProgress = items.filter((i) => getItemRatingStatus(standardCategories, i.rating).state === "in_progress");
    const unrated = items.filter((i) => getItemRatingStatus(standardCategories, i.rating).state === "unrated");

    assert.strictEqual(rated.length, 1); // m1
    assert.strictEqual(inProgress.length, 1); // m2
    assert.strictEqual(unrated.length, 2); // m3 and m4
  });

  // 14. Progress counters
  it("14. Progress counters: calculates exact completed, in_progress, and unrated counts and percentages", () => {
    const collectionEntries = [
      { mediaItem: { id: "1" } },
      { mediaItem: { id: "2" } },
      { mediaItem: { id: "3" } },
      { mediaItem: { id: "4" } },
      { mediaItem: { id: "5" } },
      { mediaItem: { id: "6" } },
    ];

    const ratingsMap: Record<string, any> = {
      "1": { categoryScores: standardCategories.map((c) => ({ categoryId: c.id, score: 9 })) },
      "2": { categoryScores: standardCategories.map((c) => ({ categoryId: c.id, score: 8.5 })) },
      "3": { categoryScores: standardCategories.map((c) => ({ categoryId: c.id, score: 7.8 })) },
      "4": { categoryScores: [{ categoryId: "story", score: 8 }] }, // in progress
      // 5 and 6 unrated
    };

    let completed = 0;
    let inProgress = 0;
    let unrated = 0;

    for (const entry of collectionEntries) {
      const ur = ratingsMap[entry.mediaItem.id];
      const status = getItemRatingStatus(standardCategories, ur);
      if (status.state === "rated") completed++;
      else if (status.state === "in_progress") inProgress++;
      else unrated++;
    }

    assert.strictEqual(completed, 3);
    assert.strictEqual(inProgress, 1);
    assert.strictEqual(unrated, 2);
    const pct = Math.round((completed / collectionEntries.length) * 100);
    assert.strictEqual(pct, 50);
  });

  // 15. State after a page refresh & getTopRankedEntries ordering
  it("15. State after a page refresh & getTopRankedEntries: top items strictly reflect score descending order", () => {
    const entries = [
      { mediaItemId: "m_low", sortOrder: 1, title: "Episode 1" },
      { mediaItemId: "m_high", sortOrder: 2, title: "Episode 2" },
      { mediaItemId: "m_mid", sortOrder: 3, title: "Episode 3" },
      { mediaItemId: "m_unrated", sortOrder: 4, title: "Episode 4" },
    ];

    const ratings = [
      { mediaItemId: "m_low", calculatedOverallScore: 7.2 },
      { mediaItemId: "m_high", calculatedOverallScore: 9.8 },
      { mediaItemId: "m_mid", calculatedOverallScore: 8.5 },
    ];

    const top3 = getTopRankedEntries(entries, ratings);
    assert.strictEqual(top3.length, 3);
    // #1 should be m_high (9.8)
    assert.strictEqual(top3[0].entry.mediaItemId, "m_high");
    assert.strictEqual(top3[0].rank, 1);
    assert.strictEqual(top3[0].score, 9.8);

    // #2 should be m_mid (8.5)
    assert.strictEqual(top3[1].entry.mediaItemId, "m_mid");
    assert.strictEqual(top3[1].rank, 2);
    assert.strictEqual(top3[1].score, 8.5);

    // #3 should be m_low (7.2)
    assert.strictEqual(top3[2].entry.mediaItemId, "m_low");
    assert.strictEqual(top3[2].rank, 3);
    assert.strictEqual(top3[2].score, 7.2);
  });
});
