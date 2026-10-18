import type { CategoryDef } from "./scoring";

/** Merge supported score formats without accepting foreign categories or coercing booleans/strings. */
export function normalizeRatingScores(
  categories: CategoryDef[],
  previous: Record<string, number | null>,
  scores: unknown,
  categoryScores: unknown,
  scale: number,
): Record<string, number> {
  const allowed = new Set(categories.map((category) => category.id));
  const result: Record<string, number> = Object.create(null);
  for (const [id, value] of Object.entries(previous)) {
    if (
      allowed.has(id) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= scale
    )
      result[id] = value;
  }
  function assign(id: string, value: unknown) {
    if (!allowed.has(id))
      throw new Error(
        "Score category does not belong to the selected rating system",
      );
    if (value === null) {
      delete result[id];
      return;
    }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > scale
    )
      throw new Error(
        `Scores must be finite numbers between 0 and ${scale}, or null to clear`,
      );
    result[id] = value;
  }
  if (categoryScores !== undefined) {
    if (!Array.isArray(categoryScores))
      throw new Error("categoryScores must be an array");
    for (const item of categoryScores) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.categoryId !== "string"
      )
        throw new Error("Each category score needs a categoryId and score");
      assign(item.categoryId, item.score);
    }
  }
  if (scores !== undefined) {
    if (!scores || typeof scores !== "object" || Array.isArray(scores))
      throw new Error("scores must be an object");
    for (const [id, value] of Object.entries(scores)) assign(id, value);
  }
  return result;
}
