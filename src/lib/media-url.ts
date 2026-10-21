/**
 * Centralized, authoritative URL builder for Aubrey media navigation (Phase 15A).
 * Consolidates all personal vs. public navigation paths across the application.
 */

export type MediaView = "overview" | "personal";

export interface MediaUrlOptions {
  view?: MediaView;
  type?: "movie" | "tv" | "episode";
  season?: number;
  journal?: boolean;
}

/**
 * Builds a canonical URL for a media item.
 *
 * Defaults:
 * - Public Title Overview: `/media/[id]`
 * - Personal "Your View": `/media/[id]?view=personal`
 * - Deep-link journal editor: `/media/[id]?journal=1`
 */
export function getMediaUrl(mediaId: string, options?: MediaUrlOptions): string {
  if (!mediaId) return "/discover";
  const encodedId = encodeURIComponent(mediaId.trim());
  const params = new URLSearchParams();

  if (options?.view === "personal") {
    params.set("view", "personal");
  }

  if (options?.type) {
    params.set("type", options.type);
  }

  if (options?.season !== undefined && options.season !== null) {
    params.set("season", String(options.season));
  }

  if (options?.journal) {
    params.set("journal", "1");
  }

  const queryString = params.toString();
  return queryString ? `/media/${encodedId}?${queryString}` : `/media/${encodedId}`;
}

/**
 * Helper to build the public Title Overview URL.
 */
export function getPublicMediaUrl(mediaId: string, options?: Omit<MediaUrlOptions, "view">): string {
  return getMediaUrl(mediaId, { ...options, view: undefined });
}

/**
 * Helper to build the personal "Your View" URL for an authenticated user.
 */
export function getPersonalMediaUrl(mediaId: string, options?: Omit<MediaUrlOptions, "view">): string {
  return getMediaUrl(mediaId, { ...options, view: "personal" });
}

/**
 * Helper for rankings / collections:
 * - Owner clicks route to "Your View"
 * - Visitor clicks route to public "Title Overview"
 */
export function getRankingMediaUrl(
  mediaId: string,
  isOwner: boolean,
  options?: Omit<MediaUrlOptions, "view">
): string {
  if (isOwner) {
    return getPersonalMediaUrl(mediaId, options);
  }
  return getPublicMediaUrl(mediaId, options);
}
