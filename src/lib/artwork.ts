export type ArtworkImageSize =
  | "w92"
  | "w154"
  | "w185"
  | "w300"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "original";

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

const KNOWN_LOCAL_PREFIXES = [
  "/uploads/",
  "/brands/",
  "/placeholders/",
  "/fonts/",
  "/prototype-art/",
  "/prototype-fonts/",
  "/prototype-previews/",
  "/placeholder-",
];

export function isLocalPath(path: string): boolean {
  return KNOWN_LOCAL_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function resolveArtworkUrl(
  path: string | null | undefined,
  size: ArtworkImageSize = "original",
  fallback = "/placeholders/backdrop-placeholder.svg"
): string {
  if (!path || typeof path !== "string" || path.trim() === "") {
    return fallback;
  }

  const cleanPath = path.trim();

  // Already an absolute HTTP/HTTPS URL
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://") || cleanPath.startsWith("data:")) {
    return cleanPath;
  }

  // Known local public assets
  if (isLocalPath(cleanPath)) {
    return cleanPath;
  }

  // TMDB paths start with a slash followed by an image hash, e.g. /7vjaCdMw15FEbDYMF6crwueUhzW.jpg
  if (cleanPath.startsWith("/")) {
    return `${TMDB_IMAGE_BASE_URL}/${size}${cleanPath}`;
  }

  // Relative TMDB image hash without leading slash
  return `${TMDB_IMAGE_BASE_URL}/${size}/${cleanPath}`;
}

export function resolvePosterUrl(
  path: string | null | undefined,
  size: ArtworkImageSize = "w500",
  fallback = "/placeholders/poster-placeholder.svg"
): string {
  return resolveArtworkUrl(path, size, fallback);
}

export function resolveStillUrl(
  path: string | null | undefined,
  size: ArtworkImageSize = "w500",
  fallback = "/placeholders/backdrop-placeholder.svg"
): string {
  return resolveArtworkUrl(path, size, fallback);
}
