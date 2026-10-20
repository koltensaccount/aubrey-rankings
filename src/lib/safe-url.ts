/**
 * Validates and sanitizes callback URLs to prevent open redirects, protocol-relative attacks,
 * backslash normalization bypasses, and script execution vectors.
 *
 * Strictly allows only safe, same-origin relative application paths.
 */
export function getSafeCallbackUrl(
  rawUrl: unknown,
  defaultUrl = "/settings?tab=account"
): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return defaultUrl;
  }

  const trimmed = rawUrl.trim();

  // Must begin with a single slash; reject empty strings or non-slash prefixes
  if (!trimmed.startsWith("/")) {
    return defaultUrl;
  }

  // Reject protocol-relative URLs (//example.com)
  if (trimmed.startsWith("//")) {
    return defaultUrl;
  }

  // Reject backslash tricks (/\evil.com, /\\evil.com, \evil.com, or embedded backslashes)
  if (trimmed.includes("\\")) {
    return defaultUrl;
  }

  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return defaultUrl;
  }

  // Reject explicit schemes (javascript:, data:, vbscript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return defaultUrl;
  }

  try {
    // Parse against a dummy base origin to validate structure
    const parsed = new URL(trimmed, "http://localhost");

    // Origin and host must remain strictly on the dummy base
    if (parsed.origin !== "http://localhost" || parsed.host !== "localhost") {
      return defaultUrl;
    }

    // Pathname must be a single-rooted relative path
    if (
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//") ||
      parsed.pathname.includes("\\")
    ) {
      return defaultUrl;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultUrl;
  }
}
