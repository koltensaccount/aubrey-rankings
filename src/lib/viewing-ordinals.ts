interface ViewingActivity {
  id: string;
  mediaItemId: string;
  eventType?: string;
  eventDate?: string | null;
  watchedDate?: string | null;
  createdAt?: Date | string;
  ordinal?: number;
  totalViewings?: number;
  isRewatch?: boolean;
}

/** Undefined eventType supports the original diary response's watchedDate field. */
export function isViewingActivity(entry: Pick<ViewingActivity, "eventType" | "watchedDate">): boolean {
  return entry.eventType === "viewing" || entry.eventType === "viewing_and_review" ||
    (entry.eventType === undefined && entry.watchedDate !== undefined);
}

export function isRewatchActivity(
  entry: Pick<ViewingActivity, "eventType" | "watchedDate" | "ordinal" | "isRewatch">,
  fallbackOrdinal = 1,
): boolean {
  return isViewingActivity(entry) && Boolean(entry.isRewatch || (entry.ordinal ?? fallbackOrdinal) > 1);
}

export function getViewingOrdinals(entries: readonly ViewingActivity[]) {
  const mediaOrdinalsMap = new Map<string, number>();
  const mediaTotalCountMap = new Map<string, number>();
  const byMedia = new Map<string, ViewingActivity[]>();
  for (const entry of entries) {
    if (!isViewingActivity(entry)) continue;
    if (typeof entry.ordinal === "number") mediaOrdinalsMap.set(entry.id, entry.ordinal);
    if (typeof entry.totalViewings === "number") {
      mediaTotalCountMap.set(entry.mediaItemId, Math.max(mediaTotalCountMap.get(entry.mediaItemId) ?? 0, entry.totalViewings));
    }
    const group = byMedia.get(entry.mediaItemId) ?? [];
    group.push(entry);
    byMedia.set(entry.mediaItemId, group);
  }
  for (const [mediaId, group] of byMedia) {
    if (!mediaTotalCountMap.has(mediaId)) mediaTotalCountMap.set(mediaId, group.length);
    const chronological = [...group].sort((a, b) => {
      const dateA = a.eventDate ?? a.watchedDate ?? "9999";
      const dateB = b.eventDate ?? b.watchedDate ?? "9999";
      return dateA.localeCompare(dateB) ||
        new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime() ||
        a.id.localeCompare(b.id);
    });
    chronological.forEach((entry, index) => {
      if (!mediaOrdinalsMap.has(entry.id)) mediaOrdinalsMap.set(entry.id, index + 1);
    });
  }
  return { mediaOrdinalsMap, mediaTotalCountMap };
}
