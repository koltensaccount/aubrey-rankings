/**
 * Username normalization, validation, and reserved words registry
 * Requirements:
 * - 3–20 characters.
 * - Lowercase normalization.
 * - Allowed characters: a-z, 0-9, underscores (_), periods (.).
 * - No spaces.
 * - Must start and end with an alphanumeric character (a-z, 0-9).
 * - No consecutive periods (..).
 * - Prohibits system routes, words, and reserved terms.
 * - Case-insensitive uniqueness.
 */

export const RESERVED_USERNAMES = new Set([
  // Core routes
  "admin",
  "administrator",
  "root",
  "api",
  "auth",
  "login",
  "logout",
  "signin",
  "signout",
  "signup",
  "register",
  "settings",
  "profile",
  "u",
  "user",
  "users",
  "onboarding",
  "create",
  "collection",
  "collections",
  "ranking",
  "rankings",
  "prototype",
  "feed",
  "explore",
  "search",
  "discover",
  "import",
  "export",
  "letterboxd",
  "tmdb",

  // Static assets & system
  "about",
  "help",
  "terms",
  "privacy",
  "support",
  "contact",
  "status",
  "blog",
  "docs",
  "null",
  "undefined",
  "system",
  "moderator",
  "bot",
  "anonymous",
  "aubrey", // Reserved for Aubrey's official canonical account
  "kolten",
]);

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

export function normalizeUsername(input: string): string {
  if (!input) return "";
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): UsernameValidationResult {
  const normalized = normalizeUsername(input);

  if (!normalized) {
    return { valid: false, error: "Username is required." };
  }

  if (normalized.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters long." };
  }

  if (normalized.length > 20) {
    return { valid: false, error: "Username cannot exceed 20 characters." };
  }

  // Check character set: only letters, numbers, underscores, and single dots
  const validCharsRegex = /^[a-z0-9_.]+$/;
  if (!validCharsRegex.test(normalized)) {
    return {
      valid: false,
      error: "Username can only contain lowercase letters, numbers, underscores, and periods.",
    };
  }

  // Must start with alphanumeric
  if (/^[^a-z0-9]/.test(normalized)) {
    return { valid: false, error: "Username must start with a letter or number." };
  }

  // Must end with alphanumeric
  if (/[^a-z0-9]$/.test(normalized)) {
    return { valid: false, error: "Username must end with a letter or number." };
  }

  // No consecutive periods
  if (/\.\./.test(normalized)) {
    return { valid: false, error: "Username cannot contain consecutive periods." };
  }

  // Reserved usernames check
  if (RESERVED_USERNAMES.has(normalized)) {
    return { valid: false, error: `The username "${normalized}" is reserved and unavailable.` };
  }

  return { valid: true, normalized };
}
