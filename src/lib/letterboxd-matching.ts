import { db } from "@/db";
import { mediaItems, importSourceMappings, type MediaItem, type ImportSourceMapping } from "@/db/schema";
import { tmdb, type TmdbSearchResult } from "@/lib/tmdb";
import { resolveMediaItem } from "@/lib/media-resolution";
import { and, eq, sql, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export interface SourceFilmCandidate {
  title: string;
  year: number | null;
  letterboxdUri?: string | null;
}

export interface MatchedMediaResult {
  mediaItem?: any;
  isSyntheticFallback?: boolean;
  confidence: "manual" | "tmdb_verified" | "exact" | "cached";
  isTvException?: boolean;
  parentShowTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface UnmatchedQuarantineResult {
  reason: "ambiguous_media" | "unmatched_media" | "missing_metadata";
  details: string;
  candidates?: Array<{
    id: number;
    title: string;
    year: number | null;
    mediaType: "movie" | "tv";
    posterPath: string | null;
    stillPath?: string | null;
    overview?: string;
  }>;
}

/**
 * Normalizes title for comparison (strips punctuation, diacritics, and collapses whitespace)
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/['"“”‘’]/g, "") // strip quotes
    .replace(/[^\w\s]/g, " ") // replace punctuation with spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Known Letterboxd TV exceptions where Letterboxd lists TV episodes or specials as films.
 * Maps normalized titles to canonical TV series and episode numbers.
 */
export const KNOWN_TV_EXCEPTIONS: Array<{
  pattern: RegExp;
  seriesTmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  seriesTitle: string;
  episodeTitle: string;
}> = [
  // Black Mirror episodes
  {
    pattern: /^black mirror:\s*the national anthem$/i,
    seriesTmdbId: 42009,
    seasonNumber: 1,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "The National Anthem",
  },
  {
    pattern: /^black mirror:\s*fifteen million merits$/i,
    seriesTmdbId: 42009,
    seasonNumber: 1,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "Fifteen Million Merits",
  },
  {
    pattern: /^black mirror:\s*the entire history of you$/i,
    seriesTmdbId: 42009,
    seasonNumber: 1,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "The Entire History of You",
  },
  {
    pattern: /^black mirror:\s*be right back$/i,
    seriesTmdbId: 42009,
    seasonNumber: 2,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "Be Right Back",
  },
  {
    pattern: /^black mirror:\s*white bear$/i,
    seriesTmdbId: 42009,
    seasonNumber: 2,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "White Bear",
  },
  {
    pattern: /^black mirror:\s*the waldo moment$/i,
    seriesTmdbId: 42009,
    seasonNumber: 2,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "The Waldo Moment",
  },
  {
    pattern: /^black mirror:\s*white christmas$/i,
    seriesTmdbId: 42009,
    seasonNumber: 2,
    episodeNumber: 4,
    seriesTitle: "Black Mirror",
    episodeTitle: "White Christmas",
  },
  {
    pattern: /^black mirror:\s*nosedive$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "Nosedive",
  },
  {
    pattern: /^black mirror:\s*playtest$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "Playtest",
  },
  {
    pattern: /^black mirror:\s*shut up and dance$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "Shut Up and Dance",
  },
  {
    pattern: /^black mirror:\s*san junipero$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 4,
    seriesTitle: "Black Mirror",
    episodeTitle: "San Junipero",
  },
  {
    pattern: /^black mirror:\s*men against fire$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 5,
    seriesTitle: "Black Mirror",
    episodeTitle: "Men Against Fire",
  },
  {
    pattern: /^black mirror:\s*hated in the nation$/i,
    seriesTmdbId: 42009,
    seasonNumber: 3,
    episodeNumber: 6,
    seriesTitle: "Black Mirror",
    episodeTitle: "Hated in the Nation",
  },
  {
    pattern: /^black mirror:\s*uss callister$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "USS Callister",
  },
  {
    pattern: /^black mirror:\s*arkangel$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "Arkangel",
  },
  {
    pattern: /^black mirror:\s*crocodile$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "Crocodile",
  },
  {
    pattern: /^black mirror:\s*hang the dj$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 4,
    seriesTitle: "Black Mirror",
    episodeTitle: "Hang the DJ",
  },
  {
    pattern: /^black mirror:\s*metalhead$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 5,
    seriesTitle: "Black Mirror",
    episodeTitle: "Metalhead",
  },
  {
    pattern: /^black mirror:\s*black museum$/i,
    seriesTmdbId: 42009,
    seasonNumber: 4,
    episodeNumber: 6,
    seriesTitle: "Black Mirror",
    episodeTitle: "Black Museum",
  },
  {
    pattern: /^black mirror:\s*striking vipers$/i,
    seriesTmdbId: 42009,
    seasonNumber: 5,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "Striking Vipers",
  },
  {
    pattern: /^black mirror:\s*smithereens$/i,
    seriesTmdbId: 42009,
    seasonNumber: 5,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "Smithereens",
  },
  {
    pattern: /^black mirror:\s*rachel, jack and ashley too$/i,
    seriesTmdbId: 42009,
    seasonNumber: 5,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "Rachel, Jack and Ashley Too",
  },
  {
    pattern: /^black mirror:\s*joan is awful$/i,
    seriesTmdbId: 42009,
    seasonNumber: 6,
    episodeNumber: 1,
    seriesTitle: "Black Mirror",
    episodeTitle: "Joan Is Awful",
  },
  {
    pattern: /^black mirror:\s*loch henry$/i,
    seriesTmdbId: 42009,
    seasonNumber: 6,
    episodeNumber: 2,
    seriesTitle: "Black Mirror",
    episodeTitle: "Loch Henry",
  },
  {
    pattern: /^black mirror:\s*beyond the sea$/i,
    seriesTmdbId: 42009,
    seasonNumber: 6,
    episodeNumber: 3,
    seriesTitle: "Black Mirror",
    episodeTitle: "Beyond the Sea",
  },
  {
    pattern: /^black mirror:\s*mazey day$/i,
    seriesTmdbId: 42009,
    seasonNumber: 6,
    episodeNumber: 4,
    seriesTitle: "Black Mirror",
    episodeTitle: "Mazey Day",
  },
  {
    pattern: /^black mirror:\s*demon 79$/i,
    seriesTmdbId: 42009,
    seasonNumber: 6,
    episodeNumber: 5,
    seriesTitle: "Black Mirror",
    episodeTitle: "Demon 79",
  },
];

/**
 * Calculates match score between a source entry and a candidate.
 * Returns a confidence value between 0.0 and 1.0.
 */
export function calculateCandidateScore(
  source: { title: string; year: number | null },
  candidate: {
    title: string;
    releaseDate?: string | null;
    voteCount?: number;
    mediaType?: string;
  }
): number {
  const normSource = normalizeTitle(source.title);
  const normCandidate = normalizeTitle(candidate.title);

  const candidateYear = candidate.releaseDate
    ? parseInt(candidate.releaseDate.slice(0, 4), 10) || null
    : null;

  const isExactTitle = normSource === normCandidate;
  const isCloseTitle =
    isExactTitle ||
    normSource.startsWith(normCandidate) ||
    normCandidate.startsWith(normSource);

  let score = 0;

  if (isExactTitle) {
    score += 0.6;
  } else if (isCloseTitle) {
    score += 0.45;
  } else {
    // If titles are substantially different, confidence drops sharply
    return 0.1;
  }

  // Year matching logic
  if (source.year && candidateYear) {
    const diff = Math.abs(source.year - candidateYear);
    if (diff === 0) {
      score += 0.35; // Perfect year match
    } else if (diff === 1) {
      score += 0.25; // Permitted 1-year discrepancy (festival vs theatrical)
    } else if (candidate.mediaType === "tv" && source.year >= candidateYear) {
      // Television show match: the series premiered prior to or during the episode's air year
      score += 0.2;
    } else {
      score -= 0.3; // Significant year difference
    }
  } else if (!source.year) {
    // Source year missing: slight neutral penalty
    score += 0.15;
  }

  // Vote count / popularity boost
  if (candidate.voteCount && candidate.voteCount > 500) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * In-memory resolution caches for this runtime session to prevent duplicate network calls.
 * Execution and preview caches are strictly isolated: preview mode results (which may include
 * synthetic preview_* media IDs) are never shared with or exposed to execution mode.
 */
const executionCache = new Map<string, MatchedMediaResult | null>();
const previewCache = new Map<string, MatchedMediaResult | null>();

export function clearResolutionCache(): void {
  executionCache.clear();
  previewCache.clear();
}

export function invalidateResolutionCache(key: string): void {
  executionCache.delete(key);
  previewCache.delete(key);
}

/**
 * Resolves a single Letterboxd source item to a canonical Aubrey media record.
 * Uses a staged resolution workflow:
 * 1. Checks persisted confirmed source mappings in `import_source_mappings`.
 * 2. Checks existing verified media items in Aubrey database.
 * 3. Checks known Letterboxd TV exceptions (e.g. Black Mirror episodes).
 * 4. Searches TMDB outside of database transactions, with scoring and disambiguation.
 * 5. Attaches canonical metadata (posters for movies, 16:9 stills for episodes).
 * 6. Never creates empty/incomplete placeholder records. Quarantines ambiguous items.
 */
export async function resolveLetterboxdMediaIdentity(
  film: SourceFilmCandidate,
  options?: {
    allowSyntheticPlaceholders?: boolean;
    persist?: boolean;
    isTestWorkspace?: boolean;
  }
): Promise<{ match: MatchedMediaResult | null; quarantine?: UnmatchedQuarantineResult }> {
  const cleanTitle = film.title.trim();
  const year = film.year;
  const uri = film.letterboxdUri?.trim() || null;
  const cacheKey = uri
    ? `uri::${uri.toLowerCase()}`
    : `${cleanTitle.toLowerCase()}::${year ?? ""}`;
  const isPreview = options?.persist === false;
  const targetCache = isPreview ? previewCache : executionCache;

  const hasTmdbCredentials = Boolean(
    process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY
  );
  const allowSynthetic =
    options?.allowSyntheticPlaceholders ??
    (process.env.AUBREY_ALLOW_SYNTHETIC_MEDIA === "1" ||
      (!hasTmdbCredentials && (process.env.CI === "true" || process.env.AUBREY_TEST_MODE === "1")));

  if (targetCache.has(cacheKey)) {
    const cached = targetCache.get(cacheKey)!;
    // Execution mode safety guard: Never return any preview_* media identity during real execution!
    if (!isPreview && cached?.mediaItem?.id && String(cached.mediaItem.id).startsWith("preview_")) {
      targetCache.delete(cacheKey);
    } else {
      return { match: cached };
    }
  }

  // -------------------------------------------------------------------------
  // STEP 1: Check Persisted Confirmed Source Mappings
  // -------------------------------------------------------------------------
  if (uri) {
    const mapping = await db.query.importSourceMappings.findFirst({
      where: (m, { and, eq }) =>
        and(eq(m.sourceService, "letterboxd"), eq(m.sourceUri, uri)),
      with: { mediaItem: true },
    });
    if (mapping?.mediaItem) {
      const result: MatchedMediaResult = {
        mediaItem: mapping.mediaItem,
        confidence: "manual",
        isTvException: mapping.sourceMediaType === "episode",
      };
      targetCache.set(cacheKey, result);
      return { match: result };
    }
  }

  const titleYearMapping = await db.query.importSourceMappings.findFirst({
    where: (m, { and, eq, isNull }) =>
      and(
        eq(m.sourceService, "letterboxd"),
        sql`lower(trim(${m.sourceTitle})) = lower(${cleanTitle})`,
        year ? eq(m.sourceYear, year) : isNull(m.sourceYear)
      ),
    with: { mediaItem: true },
  });
  if (titleYearMapping?.mediaItem) {
    const result: MatchedMediaResult = {
      mediaItem: titleYearMapping.mediaItem,
      confidence: "manual",
      isTvException: titleYearMapping.sourceMediaType === "episode",
    };
    targetCache.set(cacheKey, result);
    return { match: result };
  }

  // -------------------------------------------------------------------------
  // STEP 2: Check Existing Aubrey DB for Verified Media Records with Artwork
  // -------------------------------------------------------------------------
  const allTitleMatches = await db.query.mediaItems.findMany({
    where: (m) => sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
  });

  if (allTitleMatches.length > 1) {
    if (!year) {
      // Ambiguous: multiple records exist with this title but no year provided
      return {
        match: null,
        quarantine: {
          reason: "ambiguous_media",
          details: `Title "${cleanTitle}" matches multiple existing database films with different years (${allTitleMatches.map((m) => m.releaseDate ? m.releaseDate.slice(0, 4) : "unknown").join(", ")}) but export row specified no year. Quarantined without assignment.`,
          candidates: allTitleMatches.map((m) => ({
            id: m.tmdbId || 0,
            title: m.title,
            year: m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) || null : null,
            mediaType: m.mediaType as any,
            posterPath: m.posterPath,
            stillPath: m.stillPath,
          })),
        },
      };
    }

    const exactYearMatches = allTitleMatches.filter(
      (m) => m.releaseDate && m.releaseDate.slice(0, 4) === String(year)
    );

    if (exactYearMatches.length === 1) {
      const matchCandidate = exactYearMatches[0];
      // Do not prefer incomplete placeholder DB records over verified TMDB identities!
      // If the candidate has no TMDB ID and no artwork, fall through to TMDB search.
      if (
        matchCandidate.tmdbId != null ||
        matchCandidate.posterPath != null ||
        matchCandidate.stillPath != null
      ) {
        const result: MatchedMediaResult = {
          mediaItem: matchCandidate,
          confidence: "exact",
          isTvException: matchCandidate.mediaType === "episode",
        };
        targetCache.set(cacheKey, result);
        return { match: result };
      }
    }

    if (exactYearMatches.length > 1) {
      return {
        match: null,
        quarantine: {
          reason: "ambiguous_media",
          details: `Multiple (${exactYearMatches.length}) distinct database media records found with title "${cleanTitle}" and year ${year}. Quarantined for manual selection.`,
          candidates: exactYearMatches.map((m) => ({
            id: m.tmdbId || 0,
            title: m.title,
            year: m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) || null : null,
            mediaType: m.mediaType as any,
            posterPath: m.posterPath,
            stillPath: m.stillPath,
          })),
        },
      };
    }
  } else if (allTitleMatches.length === 1) {
    const m = allTitleMatches[0];
    const mYear = m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) : null;
    if (!year || !mYear || mYear === year) {
      // Do not prefer incomplete placeholder DB records over verified TMDB identities!
      // If the record has no TMDB ID and no artwork, fall through to TMDB search.
      if (m.tmdbId != null || m.posterPath != null || m.stillPath != null) {
        const result: MatchedMediaResult = {
          mediaItem: m,
          confidence: "exact",
          isTvException: m.mediaType === "episode",
        };
        targetCache.set(cacheKey, result);
        return { match: result };
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Check Known Letterboxd TV Exceptions
  // -------------------------------------------------------------------------
  const tvException = KNOWN_TV_EXCEPTIONS.find((e) => e.pattern.test(cleanTitle));
  if (tvException) {
    // If preview mode (persist === false), return in-memory representation without DB write
    if (options?.persist === false) {
      const result: MatchedMediaResult = {
        mediaItem: {
          id: `preview_tv_${tvException.seriesTmdbId}_s${tvException.seasonNumber}_e${tvException.episodeNumber}`,
          title: `${tvException.seriesTitle}: ${tvException.episodeTitle}`,
          mediaType: "episode",
        },
        confidence: "tmdb_verified",
        isTvException: true,
        parentShowTitle: tvException.seriesTitle,
        seasonNumber: tvException.seasonNumber,
        episodeNumber: tvException.episodeNumber,
      };
      targetCache.set(cacheKey, result);
      return { match: result };
    }

    try {
      const episodeKey = `tv_${tvException.seriesTmdbId}_s${tvException.seasonNumber}_e${tvException.episodeNumber}`;
      const resolvedEpId = await resolveMediaItem(episodeKey);
      if (resolvedEpId) {
        const epRecord = await db.query.mediaItems.findFirst({
          where: eq(mediaItems.id, resolvedEpId),
        });
        if (epRecord) {
          // Persist mapping for fast future resolution
          await db
            .insert(importSourceMappings)
            .values({
              id: `map_${randomUUID()}`,
              sourceService: "letterboxd",
              sourceUri: uri,
              sourceTitle: cleanTitle,
              sourceYear: year,
              sourceMediaType: "episode",
              mediaItemId: epRecord.id,
              confidence: "tmdb_verified",
              metadata: {
                seriesTmdbId: tvException.seriesTmdbId,
                seasonNumber: tvException.seasonNumber,
                episodeNumber: tvException.episodeNumber,
                stillPath: epRecord.stillPath,
                isTestWorkspace: Boolean(options?.isTestWorkspace),
              },
            })
            .onConflictDoNothing();

          const result: MatchedMediaResult = {
            mediaItem: epRecord,
            confidence: "tmdb_verified",
            isTvException: true,
            parentShowTitle: tvException.seriesTitle,
            seasonNumber: tvException.seasonNumber,
            episodeNumber: tvException.episodeNumber,
          };
          targetCache.set(cacheKey, result);
          return { match: result };
        }
      }
    } catch (tvErr) {
      console.warn(`[Letterboxd TV Exception Resolve Error] ${cleanTitle}:`, tvErr);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: Query TMDB API with Disambiguation and Scoring
  // -------------------------------------------------------------------------
  try {
    const searchRes = await tmdb.searchMovies(cleanTitle);
    let results: any[] = searchRes?.results || [];

    if (results.length === 0) {
      // Also attempt multi search in case it was cataloged under TV on TMDB
      const multiRes = await tmdb.searchMulti(cleanTitle);
      const multiResults = (multiRes?.results || []).filter(
        (c: any) => c.media_type === "movie" || c.media_type === "tv"
      );
      if (multiResults.length === 0) {
        return {
          match: null,
          quarantine: {
            reason: "unmatched_media",
            details: `No matching movie or television title found on TMDB for "${cleanTitle}" (${year ?? "no year"}). Placeholder creation prevented.`,
          },
        };
      }
      results = multiResults;
    }

    // Score and rank candidates (supporting movie and TV)
    const scoredCandidates = results.map((c: any) => {
      const candidateTitle = c.title || c.name || "";
      const candidateReleaseDate = c.release_date || c.first_air_date || null;
      const mediaType = c.media_type || "movie";
      return {
        candidate: c,
        mediaType,
        score: calculateCandidateScore(
          { title: cleanTitle, year },
          {
            title: candidateTitle,
            releaseDate: candidateReleaseDate,
            voteCount: c.vote_count,
            mediaType,
          }
        ),
      };
    });

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    // Check for ambiguity: multiple candidates with top scores close to each other
    if (
      scoredCandidates.length > 1 &&
      topCandidate &&
      topCandidate.score >= 0.8 &&
      scoredCandidates[1].score >= 0.8 &&
      Math.abs(topCandidate.score - scoredCandidates[1].score) < 0.08
    ) {
      return {
        match: null,
        quarantine: {
          reason: "ambiguous_media",
          details: `Multiple closely matching titles found for "${cleanTitle}" (${year ?? "no year"}). Disambiguation required.`,
          candidates: scoredCandidates.slice(0, 5).map((sc) => ({
            id: sc.candidate.id,
            title: sc.candidate.title || sc.candidate.name || "",
            year: (sc.candidate.release_date || sc.candidate.first_air_date)
              ? parseInt((sc.candidate.release_date || sc.candidate.first_air_date).slice(0, 4), 10) || null
              : null,
            mediaType: sc.mediaType,
            posterPath: sc.candidate.poster_path,
            overview: sc.candidate.overview,
          })),
        },
      };
    }

    // High confidence threshold for automatic assignment (>= 0.80)
    if (topCandidate && topCandidate.score >= 0.80) {
      const tmdbId = topCandidate.candidate.id;
      const isTv = topCandidate.mediaType === "tv";
      const resolvedMediaType = isTv ? "tv" : "movie";
      const candidateTitle = topCandidate.candidate.title || topCandidate.candidate.name || cleanTitle;
      const candidatePoster = topCandidate.candidate.poster_path;
      const candidateDate = topCandidate.candidate.release_date || topCandidate.candidate.first_air_date;

      // Preview mode: return match in-memory without persisting to database!
      if (options?.persist === false) {
        const previewResult: MatchedMediaResult = {
          mediaItem: {
            id: `preview_${resolvedMediaType}_${tmdbId}`,
            tmdbId,
            mediaType: resolvedMediaType,
            title: candidateTitle,
            posterPath: candidatePoster,
            releaseDate: candidateDate,
          },
          confidence: "tmdb_verified",
          isTvException: isTv,
        };
        targetCache.set(cacheKey, previewResult);
        return { match: previewResult };
      }

      // Persist mode: resolve through resolveMediaItem
      const identifier = isTv ? `tmdb-tv-${tmdbId}` : `tmdb-movie-${tmdbId}`;
      const resolvedId = await resolveMediaItem(identifier);
      if (resolvedId) {
        const persisted = await db.query.mediaItems.findFirst({
          where: eq(mediaItems.id, resolvedId),
        });

        if (persisted) {
          // Persist confirmed mapping in database
          await db
            .insert(importSourceMappings)
            .values({
              id: `map_${randomUUID()}`,
              sourceService: "letterboxd",
              sourceUri: uri,
              sourceTitle: cleanTitle,
              sourceYear: year,
              sourceMediaType: resolvedMediaType,
              mediaItemId: persisted.id,
              confidence: "tmdb_verified",
              metadata: {
                tmdbId,
                title: persisted.title,
                posterPath: persisted.posterPath,
                releaseDate: persisted.releaseDate,
                score: topCandidate.score,
                isTestWorkspace: Boolean(options?.isTestWorkspace),
              },
            })
            .onConflictDoNothing();

          const result: MatchedMediaResult = {
            mediaItem: persisted,
            confidence: "tmdb_verified",
            isTvException: isTv,
          };
          targetCache.set(cacheKey, result);
          return { match: result };
        }
      }
    }

    // Best candidate is below confidence threshold -> Quarantine without guessing (or fallback if synthetic allowed)
    if (allowSynthetic) {
      const result: MatchedMediaResult = {
        mediaItem: null,
        isSyntheticFallback: true,
        confidence: "exact",
        isTvException: false,
      };
      targetCache.set(cacheKey, result);
      return { match: result };
    }

    return {
      match: null,
      quarantine: {
        reason: "ambiguous_media",
        details: `Top candidate "${topCandidate?.candidate.title || topCandidate?.candidate.name}" matched with insufficient confidence (${((topCandidate?.score || 0) * 100).toFixed(0)}%). Quarantined for review.`,
        candidates: scoredCandidates.slice(0, 5).map((sc) => ({
          id: sc.candidate.id,
          title: sc.candidate.title || sc.candidate.name || "",
          year: (sc.candidate.release_date || sc.candidate.first_air_date)
            ? parseInt((sc.candidate.release_date || sc.candidate.first_air_date).slice(0, 4), 10) || null
            : null,
          mediaType: sc.mediaType,
          posterPath: sc.candidate.poster_path,
          overview: sc.candidate.overview,
        })),
      },
    };
  } catch (err: any) {
    console.warn(`[TMDB Resolution Error] Failed to search for "${cleanTitle}":`, err?.message || err);
    if (allowSynthetic) {
      const result: MatchedMediaResult = {
        mediaItem: null,
        isSyntheticFallback: true,
        confidence: "exact",
        isTvException: false,
      };
      targetCache.set(cacheKey, result);
      return { match: result };
    }
    return {
      match: null,
      quarantine: {
        reason: "unmatched_media",
        details: `Network or TMDB service error during candidate resolution: ${err?.message || "Lookup failed"}. Placeholder creation prevented.`,
      },
    };
  }
}

/**
 * Pre-resolves identities in batch with bounded concurrency (throttled to 5 parallel requests).
 * External network requests are executed OUTSIDE of any database transactions.
 */
export async function batchResolveIdentities(
  films: SourceFilmCandidate[],
  concurrency = 5,
  options?: {
    allowSyntheticPlaceholders?: boolean;
    persist?: boolean;
    isTestWorkspace?: boolean;
  }
): Promise<{
  resolvedMap: Map<string, MatchedMediaResult>;
  quarantineMap: Map<string, UnmatchedQuarantineResult>;
  stats: {
    total: number;
    matched: number;
    tvExceptions: number;
    quarantined: number;
  };
}> {
  const resolvedMap = new Map<string, MatchedMediaResult>();
  const quarantineMap = new Map<string, UnmatchedQuarantineResult>();

  // Deduplicate by distinct Letterboxd URI when available, otherwise by title::year
  const uniqueFilms = new Map<string, SourceFilmCandidate>();
  for (const f of films) {
    const key = f.letterboxdUri?.trim()
      ? f.letterboxdUri.trim().toLowerCase()
      : `${f.title.trim().toLowerCase()}::${f.year ?? ""}`;
    if (!uniqueFilms.has(key)) {
      uniqueFilms.set(key, f);
    }
  }

  const entries = Array.from(uniqueFilms.entries());
  let tvExceptionsCount = 0;

  // Process in chunks to limit concurrency
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ([key, film]) => {
        const { match, quarantine } = await resolveLetterboxdMediaIdentity(film, options);
        const titleYearKey = `${film.title.trim().toLowerCase()}::${film.year ?? ""}`;
        if (match) {
          resolvedMap.set(key, match);
          if (film.letterboxdUri) resolvedMap.set(film.letterboxdUri.trim().toLowerCase(), match);
          if (!resolvedMap.has(titleYearKey)) {
            resolvedMap.set(titleYearKey, match);
          }
          if (match.isTvException) tvExceptionsCount++;
        } else if (quarantine) {
          quarantineMap.set(key, quarantine);
          if (film.letterboxdUri) quarantineMap.set(film.letterboxdUri.trim().toLowerCase(), quarantine);
          if (!quarantineMap.has(titleYearKey)) {
            quarantineMap.set(titleYearKey, quarantine);
          }
        }
      })
    );
  }

  return {
    resolvedMap,
    quarantineMap,
    stats: {
      total: entries.length,
      matched: resolvedMap.size,
      tvExceptions: tvExceptionsCount,
      quarantined: quarantineMap.size,
    },
  };
}
