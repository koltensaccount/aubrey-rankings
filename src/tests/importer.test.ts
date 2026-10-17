import assert from "node:assert";
import { describe, it } from "node:test";
import { findMatchingEpisode, BLACK_MIRROR_EPISODES } from "../lib/importer";
import { calculateWeightedAverage } from "../lib/scoring";

describe("Black Mirror Importer & Matcher", () => {
  it("matches episode titles with slight punctuation or casing differences", () => {
    const ep1 = findMatchingEpisode("White Christmas");
    assert.strictEqual(ep1?.season, 2);
    assert.strictEqual(ep1?.episode, 4);

    const ep2 = findMatchingEpisode("San Junipero!");
    assert.strictEqual(ep2?.season, 3);
    assert.strictEqual(ep2?.episode, 4);

    const ep3 = findMatchingEpisode("the entire history of you");
    assert.strictEqual(ep3?.season, 1);
    assert.strictEqual(ep3?.episode, 3);
  });

  it("calculates accurate weighted scores for imported spreadsheet rows", () => {
    const categories = [
      { id: "music", name: "Music / Sound Design", weight: 3, isRequired: true },
      { id: "acting", name: "Acting", weight: 8, isRequired: true },
      { id: "cinema", name: "Cinematography", weight: 7, isRequired: true },
      { id: "writing", name: "Writing", weight: 8, isRequired: true },
      { id: "vibes", name: "Vibes", weight: 8, isRequired: true },
    ];

    const scores = {
      music: 8,
      acting: 9,
      cinema: 9,
      writing: 10,
      vibes: 9,
    };

    const result = calculateWeightedAverage(categories, scores);
    assert.strictEqual(result.weightedScore, 9.15);
    assert.strictEqual(result.isComplete, true);
  });
});
