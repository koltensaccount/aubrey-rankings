import assert from "node:assert";
import { describe, it } from "node:test";
import { calculateWeightedAverage } from "../lib/scoring";

describe("Scoring Engine - calculateWeightedAverage", () => {
  it("calculates accurate weighted average for Aubrey's Black Mirror configuration", () => {
    const categories = [
      { id: "music", name: "Music / Sound Design", weight: 3, isRequired: true },
      { id: "acting", name: "Acting", weight: 8, isRequired: true },
      { id: "cinema", name: "Cinematography", weight: 7, isRequired: true },
      { id: "writing", name: "Writing", weight: 8, isRequired: true },
      { id: "vibes", name: "Vibes", weight: 8, isRequired: true },
    ];

    // Scores out of 10
    const scores = {
      music: 9, // 9 * 3 = 27
      acting: 10, // 10 * 8 = 80
      cinema: 8.5, // 8.5 * 7 = 59.5
      writing: 9, // 9 * 8 = 72
      vibes: 10, // 10 * 8 = 80
      // sum = 318.5
      // total weight = 3 + 8 + 7 + 8 + 8 = 34
      // 318.5 / 34 = 9.3676... -> 9.37
    };

    const res = calculateWeightedAverage(categories, scores);
    assert.strictEqual(res.weightedScore, 9.37);
    assert.strictEqual(res.totalApplicableWeight, 34);
    assert.strictEqual(res.isComplete, true);
  });

  it("handles missing optional categories correctly", () => {
    const categories = [
      { id: "acting", name: "Acting", weight: 5, isRequired: true },
      { id: "vibes", name: "Vibes", weight: 5, isRequired: false },
    ];

    const scores = {
      acting: 8,
    };

    const res = calculateWeightedAverage(categories, scores);
    assert.strictEqual(res.weightedScore, 8);
    assert.strictEqual(res.totalApplicableWeight, 5);
    assert.strictEqual(res.isComplete, true);
  });

  it("safely handles zero total weight or empty scores", () => {
    const categories = [
      { id: "acting", name: "Acting", weight: 0, isRequired: true },
    ];
    const scores = { acting: 9 };
    const res = calculateWeightedAverage(categories, scores);
    assert.strictEqual(res.weightedScore, null);
    assert.strictEqual(res.totalApplicableWeight, 0);

    const emptyRes = calculateWeightedAverage([], {});
    assert.strictEqual(emptyRes.weightedScore, null);
  });

  it("flags incomplete ratings when required categories are missing", () => {
    const categories = [
      { id: "cat1", name: "Acting", weight: 5, isRequired: true },
      { id: "cat2", name: "Writing", weight: 5, isRequired: true },
    ];
    const scores = { cat1: 9 };
    const res = calculateWeightedAverage(categories, scores);
    assert.strictEqual(res.isComplete, false);
    assert.strictEqual(res.totalScoredCategories, 1);
  });
});
