/** Calendar dates retain their source day; timestamps use the viewer's timezone. */
export function formatReviewDate(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" },
): string | null {
  if (!value) return null;
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value instanceof Date ? value : new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime()) || (dateOnly && date.toISOString().slice(0, 10) !== value)) return null;
  return new Intl.DateTimeFormat("en-US", dateOnly ? { ...options, timeZone: "UTC" } : options).format(date);
}
