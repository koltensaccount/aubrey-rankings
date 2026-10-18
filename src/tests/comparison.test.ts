import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareRankings, ComparisonItem } from "../lib/comparison";

describe("Stage 6: Canon Comparison & Disagreement Analytics", () => {
  it("1. Identical Rankings: returns +1.00 correlation and 100% concordance", () => {
    const itemsA: ComparisonItem[] = [
      { mediaItemId: "m1", title: "San Junipero", rank: 1, score: 9.8 },
      { mediaItemId: "m2", title: "White Christmas", rank: 2, score: 9.5 },
      { mediaItemId: "m3", title: "Nosedive", rank: 3, score: 8.8 },
      { mediaItemId: "m4", title: "Shut Up and Dance", rank: 4, score: 8.2 },
    ];
    const itemsB: ComparisonItem[] = [
      { mediaItemId: "m1", title: "San Junipero", rank: 1, score: 9.7 },
      { mediaItemId: "m2", title: "White Christmas", rank: 2, score: 9.4 },
      { mediaItemId: "m3", title: "Nosedive", rank: 3, score: 8.9 },
      { mediaItemId: "m4", title: "Shut Up and Dance", rank: 4, score: 8.0 },
    ];

    const result = compareRankings(itemsA, itemsB);

    assert.equal(result.overlappingCount, 4);
    assert.equal(result.spearmanCorrelation, 1.0);
    assert.equal(result.concordancePercentage, 100);
    assert.equal(result.alignmentRating, "Identical");
    assert.ok(result.meanScoreDifference !== null && result.meanScoreDifference < 0.2);
  });

  it("2. Inverted Rankings: returns -1.00 correlation and 0% concordance", () => {
    const itemsA: ComparisonItem[] = [
      { mediaItemId: "m1", title: "San Junipero", rank: 1, score: 10.0 },
      { mediaItemId: "m2", title: "White Christmas", rank: 2, score: 8.0 },
      { mediaItemId: "m3", title: "Nosedive", rank: 3, score: 6.0 },
      { mediaItemId: "m4", title: "The Waldo Moment", rank: 4, score: 4.0 },
    ];
    // Exact reverse order
    const itemsB: ComparisonItem[] = [
      { mediaItemId: "m4", title: "The Waldo Moment", rank: 1, score: 9.5 },
      { mediaItemId: "m3", title: "Nosedive", rank: 2, score: 8.0 },
      { mediaItemId: "m2", title: "White Christmas", rank: 3, score: 7.0 },
      { mediaItemId: "m1", title: "San Junipero", rank: 4, score: 5.0 },
    ];

    const result = compareRankings(itemsA, itemsB);

    assert.equal(result.overlappingCount, 4);
    assert.equal(result.spearmanCorrelation, -1.0);
    assert.equal(result.concordancePercentage, 0);
    assert.equal(result.alignmentRating, "Polar Opposites");
    assert.equal(result.divergentItems[0].title, "San Junipero"); // or Waldo Moment (rank delta of 3)
    assert.equal(Math.abs(result.divergentItems[0].rankDelta), 3);
  });

  it("3. Partial Overlap: handles different item sets and calculates disparities", () => {
    const itemsA: ComparisonItem[] = [
      { mediaItemId: "m1", title: "Oppenheimer", rank: 1, score: 9.4 },
      { mediaItemId: "m2", title: "Interstellar", rank: 2, score: 9.2 },
      { mediaItemId: "m3", title: "The Prestige", rank: 3, score: 9.0 },
      { mediaItemId: "m_only_a", title: "Memento", rank: 4, score: 8.8 },
    ];
    const itemsB: ComparisonItem[] = [
      { mediaItemId: "m2", title: "Interstellar", rank: 1, score: 9.9 },
      { mediaItemId: "m1", title: "Oppenheimer", rank: 2, score: 8.5 },
      { mediaItemId: "m3", title: "The Prestige", rank: 3, score: 8.9 },
      { mediaItemId: "m_only_b", title: "Inception", rank: 4, score: 9.1 },
    ];

    const result = compareRankings(itemsA, itemsB);

    assert.equal(result.overlappingCount, 3);
    assert.equal(result.leftTotalCount, 4);
    assert.equal(result.rightTotalCount, 4);
    assert.ok(result.spearmanCorrelation !== null && result.spearmanCorrelation > 0);
    assert.equal(result.alignmentRating, "Moderate Divergence");
  });

  it("4. Edge Cases: zero overlaps or fewer than 2 items", () => {
    const emptyResult = compareRankings([], []);
    assert.equal(emptyResult.overlappingCount, 0);
    assert.equal(emptyResult.spearmanCorrelation, null);
    assert.equal(emptyResult.alignmentRating, "Insufficient Data");

    const singleResult = compareRankings(
      [{ mediaItemId: "m1", title: "Only Item", rank: 1, score: 8.0 }],
      [{ mediaItemId: "m1", title: "Only Item", rank: 1, score: 9.0 }]
    );
    assert.equal(singleResult.overlappingCount, 1);
    assert.equal(singleResult.spearmanCorrelation, null);
    assert.equal(singleResult.alignmentRating, "Insufficient Data");
  });
});
