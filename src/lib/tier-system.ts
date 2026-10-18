/**
 * Aubrey Rankings: First-Class Tier Rating Systems
 * Definitions, presets, and validation for customizable ordered tier lists.
 */

export const SYSTEM_TIER_TEMPLATE_ID = "rs_template_standard_tiers";

export interface TierItem {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  sortOrder: number;
}

export const STANDARD_TIERS_PRESET: Array<Omit<TierItem, "id"> & { id?: string }> = [
  { id: "tier_std_s", name: "S", description: "Masterpiece / Elite", color: "#FF4757", sortOrder: 1 },
  { id: "tier_std_a", name: "A", description: "Great / Highly Recommended", color: "#FFA502", sortOrder: 2 },
  { id: "tier_std_b", name: "B", description: "Good / Solid", color: "#2ED573", sortOrder: 3 },
  { id: "tier_std_c", name: "C", description: "Average / Mixed", color: "#1E90FF", sortOrder: 4 },
  { id: "tier_std_d", name: "D", description: "Subpar / Disappointing", color: "#747D8C", sortOrder: 5 },
];

/**
 * Validates a tier list configuration.
 */
export function validateTierList(tiers: any[]): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error("A tier system must have at least one tier");
  }
  if (tiers.length > 20) {
    throw new Error("A tier system cannot exceed 20 tiers");
  }

  const seenNames = new Set<string>();
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t || typeof t.name !== "string" || !t.name.trim()) {
      throw new Error(`Tier at position ${i + 1} must have a non-empty name`);
    }
    const cleanName = t.name.trim().toUpperCase();
    if (seenNames.has(cleanName)) {
      throw new Error(`Duplicate tier name "${t.name.trim()}". Tier names must be unique.`);
    }
    seenNames.add(cleanName);

    if (t.color && typeof t.color === "string") {
      const isValidColor =
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.color) ||
        t.color.startsWith("oklch(") ||
        t.color.startsWith("rgb(");
      if (!isValidColor) {
        throw new Error(`Invalid color "${t.color}" for tier "${t.name}"`);
      }
    }
  }
}
