import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeRatingScores } from "../lib/rating-validation";
import { calculateWeightedAverage } from "../lib/scoring";
const categories = [
  { id: "writing", name: "Writing", weight: 2 },
  { id: "acting", name: "Acting", weight: 1 },
];
describe("Rating mutation validation", () => {
  it("accepts array input, preserves zero, clears null, and calculates from the same scores", () => {
    const scores = normalizeRatingScores(
      categories,
      { acting: 8 },
      undefined,
      [{ categoryId: "writing", score: 0 }],
      10,
    );
    assert.equal(scores.writing, 0);
    assert.equal(scores.acting, 8);
    assert.equal(
      calculateWeightedAverage(categories, scores).weightedScore,
      2.67,
    );
    const cleared = normalizeRatingScores(
      categories,
      scores,
      { acting: null },
      undefined,
      10,
    );
    assert.equal(cleared.acting, undefined);
  });
  it("drops scores from a previous system and rejects foreign input categories", () => {
    assert.equal(
      normalizeRatingScores(
        categories,
        { foreign: 10 },
        undefined,
        undefined,
        10,
      ).foreign,
      undefined,
    );
    assert.throws(
      () =>
        normalizeRatingScores(categories, {}, { foreign: 10 }, undefined, 10),
      /does not belong/,
    );
  });
  it("rejects non-finite, out-of-scale, coerced, and malformed scores", () => {
    for (const score of [Infinity, NaN, -1, 11, true, "8", ""])
      assert.throws(() =>
        normalizeRatingScores(
          categories,
          {},
          { writing: score },
          undefined,
          10,
        ),
      );
    for (const value of [null, [], "bad"])
      assert.throws(() =>
        normalizeRatingScores(categories, {}, value, undefined, 10),
      );
    assert.throws(() =>
      normalizeRatingScores(categories, {}, undefined, {}, 10),
    );
    assert.throws(() =>
      normalizeRatingScores(categories, {}, undefined, [null], 10),
    );
  });
  it("does not let non-finite values poison weighted aggregates", () => {
    assert.equal(
      calculateWeightedAverage(categories, { writing: Infinity, acting: 8 })
        .weightedScore,
      8,
    );
    assert.equal(
      calculateWeightedAverage(
        [{ id: "x", name: "Bad weight", weight: Infinity }],
        { x: 8 },
      ).weightedScore,
      null,
    );
  });
});
