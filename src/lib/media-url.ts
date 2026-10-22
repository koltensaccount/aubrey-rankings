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
  from?: string;
}

/**
 * Validates and sanitizes an in-app return path to guarantee safe navigation.
 * Rejects external schemes (http, https, //, javascript:), control chars, and non-whitelisted paths.
 * Prevents navigation loops by rejecting media paths as return destinations.
 */
export function sanitizeInternalReturnUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // Must begin with a single slash (relative path on same origin)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }

  // Disallow protocol schemes or colon anywhere before a query parameter
  const pathPart = trimmed.split("?")[0];
  if (pathPart.includes(":") || /^[a-zA-Z][a-zA-Z\d+\-.]*:/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://aubrey.local");
    if (parsed.origin !== "https://aubrey.local") return null;
    const path = parsed.pathname;

    // Reject media detail pages as return targets to prevent back-navigation loops
    if (path.startsWith("/media/")) {
      return null;
    }

    // Whitelist allowed in-app origins
    const isAllowed =
      path === "/" ||
      path === "/discover" ||
      path === "/explore" ||
      path === "/feed" ||
      path.startsWith("/collection/") ||
      path.startsWith("/u/") ||
      path === "/profile" ||
      path === "/notifications" ||
      path === "/settings";

    if (!isAllowed) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export interface ContextualBackInfo {
  href: string;
  label: string;
}

/**
 * Derives contextual back navigation metadata (target href and human label)
 * based on originating URL context and fallback view.
 */
export function getContextualBackInfo(
  returnPath?: string | null,
  fallbackView: "personal" | "overview" = "overview"
): ContextualBackInfo {
  const safePath = sanitizeInternalReturnUrl(returnPath);
  if (!safePath) {
    return fallbackView === "personal"
      ? { href: "/?tab=journal", label: "Back to Journal" }
      : { href: "/discover", label: "Back to Discover" };
  }

  const [path, search] = safePath.split("?");
  const searchParams = new URLSearchParams(search || "");

  if (path === "/") {
    const tab = searchParams.get("tab")?.toLowerCase();
    if (tab === "watched") return { href: safePath, label: "Back to Watched" };
    if (tab === "watchlist") return { href: safePath, label: "Back to Watchlist" };
    if (tab === "rankings") return { href: safePath, label: "Back to Rankings" };
    return { href: safePath, label: "Back to Journal" };
  }

  if (path.startsWith("/collection/")) {
    return { href: safePath, label: "Back to Ranking" };
  }
  if (path === "/feed") {
    return { href: safePath, label: "Back to Feed" };
  }
  if (path === "/discover" || path === "/explore") {
    return { href: safePath, label: "Back to Discover" };
  }
  if (path.startsWith("/u/") || path === "/profile") {
    return { href: safePath, label: "Back to Profile" };
  }

  return {
    href: safePath,
    label: fallbackView === "personal" ? "Back to Journal" : "Back to Discover",
  };
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

  if (options?.from) {
    const sanitized = sanitizeInternalReturnUrl(options.from);
    if (sanitized) {
      params.set("from", sanitized);
    }
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
