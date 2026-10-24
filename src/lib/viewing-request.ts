/** Editing state carries the authoritative diary ID, independent of its format. */
export function viewingSaveTarget(existingEntry?: { id: string } | null): { url: string; method: "PATCH" | "POST" } {
  if (!existingEntry) return { url: "/api/diary", method: "POST" };
  if (!existingEntry.id) throw new Error("Missing viewing identity");
  return { url: `/api/diary/${encodeURIComponent(existingEntry.id)}`, method: "PATCH" };
}
