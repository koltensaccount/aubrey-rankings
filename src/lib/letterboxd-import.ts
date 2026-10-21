import { db } from "@/db";
import {
  mediaItems,
  ratings,
  reviews,
  diaryEntries,
  watchlistItems,
  collections,
  collectionEntries,
  unresolvedImportItems,
  importSourceMappings,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  buildDiaryEventKey,
  canonicalFilmKey,
  normalizeLetterboxdFilmUri,
  type LetterboxdExportSummary,
  type ParsedLetterboxdFilm,
} from "./letterboxd";
import {
  batchResolveIdentities,
  resolveLetterboxdMediaIdentity,
  type SourceFilmCandidate,
} from "./letterboxd-matching";
import { TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";

export function filmIdentity(film: { title: string; year: number | null }) {
  return `${film.title.trim().toLowerCase()}::${film.year ?? ""}`;
}

export type LetterboxdImportInput = LetterboxdExportSummary | ParsedLetterboxdFilm[];

function normalizeSummary(input: LetterboxdImportInput): LetterboxdExportSummary {
  if (!Array.isArray(input)) return input;
  return {
    totalUniqueFilms: input.length,
    totalRatings: input.filter((f) => f.rating !== undefined).length,
    totalReviews: input.filter((f) => Boolean(f.review)).length,
    totalWatched: input.filter((f) => f.isWatched).length,
    totalDiaryEntries: 0,
    totalWatchlistItems: 0,
    totalCustomLists: 0,
    totalCustomListEntries: 0,
    totalLikes: input.filter((f) => Boolean(f.isFavorite)).length,
    films: input,
    diaryEntries: [],
    reviews: input
      .filter((f) => Boolean(f.review))
      .map((f) => ({
        title: f.title,
        year: f.year,
        letterboxdUri: f.letterboxdUri,
        reviewDate: f.reviewDate || null,
        watchedDate: f.watchDate || null,
        rating: f.rating,
        isRewatch: false,
        review: f.review!,
        tags: [],
      })),
    watchlist: [],
    customLists: [],
    likedFilms: input
      .filter((f) => Boolean(f.isFavorite))
      .map((f) => ({ title: f.title, year: f.year, letterboxdUri: f.letterboxdUri })),
    unresolved: [],
    unsupportedItems: [],
  };
}

export async function previewLetterboxdImport(
  userId: string,
  input: LetterboxdImportInput,
  options?: { allowSyntheticPlaceholders?: boolean }
) {
  const summary = normalizeSummary(input);

  // Pre-resolve candidates to guarantee preview and execution use identical resolution logic
  const candidateMap = new Map<string, SourceFilmCandidate>();
  const addCandidate = (c: { title: string; year: number | null; letterboxdUri?: string | null }) => {
    const k = canonicalFilmKey(c);
    if (!candidateMap.has(k)) {
      candidateMap.set(k, { title: c.title, year: c.year, letterboxdUri: c.letterboxdUri });
    }
  };
  for (const f of summary.films) addCandidate(f);
  for (const d of summary.diaryEntries) addCandidate(d);
  for (const r of summary.reviews) addCandidate(r);
  for (const w of summary.watchlist) addCandidate(w);
  for (const l of summary.customLists) {
    for (const e of l.entries) addCandidate(e);
  }

  const { resolvedMap, quarantineMap, stats: preResolveStats } = await batchResolveIdentities(
    Array.from(candidateMap.values()),
    5,
    { ...options, persist: false, isTestWorkspace: userId === TEST_WORKSPACE_USER_ID }
  );
  // 1. Existing global ratings
  const existingRatings = await db.query.ratings.findMany({
    where: (r, { and, eq, isNull }) =>
      and(eq(r.userId, userId), isNull(r.collectionId)),
    with: { mediaItem: true },
  });

  const existingRatingKeys = new Set<string>();
  for (const r of existingRatings) {
    if (r.mediaItem.mediaType !== "movie") continue;
    const year = r.mediaItem.releaseDate
      ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
      : null;
    existingRatingKeys.add(
      canonicalFilmKey({
        title: r.mediaItem.title,
        year,
        letterboxdUri: r.letterboxdUri,
      })
    );
    if (r.letterboxdUri) {
      existingRatingKeys.add(normalizeLetterboxdFilmUri(r.letterboxdUri));
    }
    existingRatingKeys.add(
      filmIdentity({
        title: r.mediaItem.title,
        year,
      })
    );
  }

  // Detect existing Aubrey-specific manual ratings/edits that won't be overwritten
  let preservedRatingsCount = 0;
  for (const r of existingRatings) {
    const isAubreyEdit =
      r.calculatedOverallScore !== null ||
      r.tierId !== null ||
      (r.sourceService !== null && r.sourceService !== "letterboxd");
    if (isAubreyEdit) {
      preservedRatingsCount++;
    }
  }

  // 2. Existing first-class reviews
  const existingReviews = await db.query.reviews.findMany({
    where: (rev, { eq }) => eq(rev.userId, userId),
    columns: { id: true, mediaItemId: true, sourceService: true, sourceUri: true },
  });
  const existingReviewUris = new Set(
    existingReviews.map((r) => r.sourceUri).filter(Boolean),
  );

  // 3. Existing watchlist
  const existingWatchlist = await db.query.watchlistItems.findMany({
    where: (w, { eq }) => eq(w.userId, userId),
    with: { mediaItem: true },
  });
  const existingWatchlistKeys = new Set(
    existingWatchlist
      .filter((w) => Boolean(w.mediaItem))
      .map((w) =>
        filmIdentity({
          title: w.mediaItem.title,
          year: w.mediaItem.releaseDate
            ? Number(w.mediaItem.releaseDate.slice(0, 4)) || null
            : null,
        }),
      ),
  );

  // 4. Existing diary entries
  const existingDiary = await db.query.diaryEntries.findMany({
    where: (d, { eq }) => eq(d.userId, userId),
    columns: { id: true, sourceEventKey: true },
  });
  const existingDiaryEventKeys = new Set(
    existingDiary.map((d) => d.sourceEventKey).filter(Boolean),
  );

  // 5. Existing custom lists
  const existingLists = await db.query.collections.findMany({
    where: (c, { and, eq }) =>
      and(eq(c.userId, userId), eq(c.collectionType, "custom")),
    columns: { id: true, title: true, sourceUri: true },
  });
  const existingListUris = new Set(
    existingLists.map((l) => l.sourceUri).filter(Boolean),
  );
  const existingListTitles = new Set(
    existingLists.map((l) => l.title.trim().toLowerCase()),
  );

  const existingCount = summary.films.filter(
    (film) =>
      existingRatingKeys.has(canonicalFilmKey(film)) ||
      (film.letterboxdUri && existingRatingKeys.has(normalizeLetterboxdFilmUri(film.letterboxdUri))) ||
      existingRatingKeys.has(filmIdentity(film)),
  ).length;
  const newCount = summary.films.length - existingCount;

  // When called with legacy film array directly, maintain strict deep-equality compatibility
  if (Array.isArray(input)) {
    return { existingCount, newCount };
  }

  const newReviewsCount = summary.reviews.filter(
    (r) => !r.letterboxdUri || !existingReviewUris.has(r.letterboxdUri),
  ).length;

  const newDiaryCount = summary.diaryEntries.filter((d) => {
    const key = d.sourceEventKey || buildDiaryEventKey(d);
    return !existingDiaryEventKeys.has(key);
  }).length;

  const newWatchlistCount = summary.watchlist.filter(
    (w) => !existingWatchlistKeys.has(filmIdentity(w)),
  ).length;

  const newListsCount = summary.customLists.filter(
    (l) =>
      (!l.url || !existingListUris.has(l.url)) &&
      !existingListTitles.has(l.title.trim().toLowerCase()),
  ).length;

  const newRatingsCount = summary.films.filter(
    (f) =>
      f.rating !== undefined &&
      !existingRatingKeys.has(canonicalFilmKey(f)) &&
      !(f.letterboxdUri && existingRatingKeys.has(normalizeLetterboxdFilmUri(f.letterboxdUri))) &&
      !existingRatingKeys.has(filmIdentity(f)),
  ).length;

  const unsupportedReasons: string[] = [];
  if (summary.unresolved.length > 0) {
    unsupportedReasons.push(
      `${summary.unresolved.length} archive entries have missing metadata or malformed fields and will be quarantined in your unresolved import log.`,
    );
  }
  for (const item of summary.unsupportedItems || []) {
    unsupportedReasons.push(`${item.filename}: ${item.details}`);
  }

  const totalUnsupportedCount = (summary.unresolved.length) + (summary.unsupportedItems?.length || 0);

  return {
    existingCount,
    newCount,
    totalFilms: summary.totalUniqueFilms,
    totalWatched: summary.totalWatched,
    totalRatings: summary.totalRatings,
    totalReviews: summary.totalReviews,
    totalDiaryEntries: summary.totalDiaryEntries,
    totalWatchlistItems: summary.totalWatchlistItems,
    totalCustomLists: summary.totalCustomLists,
    totalCustomListEntries: summary.totalCustomListEntries,
    totalLikes: summary.totalLikes,
    breakdown: {
      films: { new: newCount, existing: existingCount },
      ratings: {
        new: newRatingsCount,
        existing: summary.totalRatings - newRatingsCount,
        preservedAubreyEdits: preservedRatingsCount,
      },
      reviews: {
        new: newReviewsCount,
        existing: summary.reviews.length - newReviewsCount,
      },
      diary: {
        new: newDiaryCount,
        existing: summary.diaryEntries.length - newDiaryCount,
      },
      watchlist: {
        new: newWatchlistCount,
        existing: summary.watchlist.length - newWatchlistCount,
      },
      lists: {
        new: newListsCount,
        existing: summary.customLists.length - newListsCount,
        entries: summary.totalCustomListEntries,
      },
      likes: { count: summary.totalLikes },
      ambiguous: summary.unresolved.length,
      unsupported: totalUnsupportedCount,
    },
    unsupportedReasons,
    sampleFilms: summary.films.slice(0, 10).map((f) => ({
      title: f.title,
      year: f.year,
      rating: f.rating ?? null,
      hasReview: Boolean(f.review),
      watchDate: f.watchDate ?? null,
    })),
    sampleLists: summary.customLists.slice(0, 5).map((l) => ({
      title: l.title,
      entryCount: l.entries.length,
    })),
  };
}

/**
 * Executes an atomic, non-destructive, idempotent Letterboxd import.
 * Strictly separates film identity from viewing event identity.
 * Reconciles watched status, viewing diary events, ratings, reviews, watchlist,
 * custom lists, likes/favorites, and source provenance.
 * Quarantines ambiguous records rather than guessing.
 */
export async function executeLetterboxdImport(
  userId: string,
  input: LetterboxdImportInput,
  options?: { allowSyntheticPlaceholders?: boolean }
) {
  const summary = normalizeSummary(input);

  // 1. Pre-resolve identities outside of database write transaction
  const candidateMap = new Map<string, SourceFilmCandidate>();
  const addCandidate = (c: { title: string; year: number | null; letterboxdUri?: string | null }) => {
    const k = canonicalFilmKey(c);
    if (!candidateMap.has(k)) {
      candidateMap.set(k, { title: c.title, year: c.year, letterboxdUri: c.letterboxdUri });
    }
  };
  for (const f of summary.films) addCandidate(f);
  for (const d of summary.diaryEntries) addCandidate(d);
  for (const r of summary.reviews) addCandidate(r);
  for (const w of summary.watchlist) addCandidate(w);
  for (const l of summary.customLists) {
    for (const e of l.entries) addCandidate(e);
  }

  const { resolvedMap, quarantineMap, stats: preResolveStats } = await batchResolveIdentities(
    Array.from(candidateMap.values()),
    5,
    { ...options, persist: true, isTestWorkspace: userId === TEST_WORKSPACE_USER_ID }
  );
  return db.transaction(async (tx) => {
    // 1. Acquire transaction-scoped advisory lock to serialize imports
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('aubrey:letterboxd-import', 0))`,
    );

    // Verify user exists
    const targetUser = await tx.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { id: true },
    });
    if (!targetUser) {
      throw new Error(`User not found: ${userId}`);
    }

    // 2. Load existing ratings for this user
    const userRatings = await tx.query.ratings.findMany({
      where: (r, { and, eq, isNull }) =>
        and(eq(r.userId, userId), isNull(r.collectionId)),
      with: { mediaItem: true },
    });

    const ratingByIdentity = new Map<string, any>();
    for (const r of userRatings) {
      if (r.mediaItem.mediaType !== "movie") continue;
      const canonKey = canonicalFilmKey({
        title: r.mediaItem.title,
        year: r.mediaItem.releaseDate
          ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
          : null,
        letterboxdUri: r.letterboxdUri,
      });
      ratingByIdentity.set(canonKey, r);
      if (r.letterboxdUri) {
        ratingByIdentity.set(normalizeLetterboxdFilmUri(r.letterboxdUri), r);
      }
      const rawIdentity = filmIdentity({
        title: r.mediaItem.title,
        year: r.mediaItem.releaseDate
          ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
          : null,
      });
      if (!ratingByIdentity.has(rawIdentity)) {
        ratingByIdentity.set(rawIdentity, r);
      }
    }

    // Media cache for fast resolution during transaction
    const mediaCache = new Map<string, any>();
    const mediaIdToUri = new Map<string, string>();
    const resolvedMediaMap = new Map<string, string>(); // film identity -> media_item_id
    const ambiguousIdentities = new Set<string>();

    /**
     * Resolves media item using pre-resolved verified identity matching.
     * Prevents empty unverified placeholder records from being created.
     */
    const resolveOrCreateMedia = async (
      title: string,
      year: number | null,
      uri?: string,
    ) => {
      const cleanTitle = title.trim();
      const identityKey = filmIdentity({ title: cleanTitle, year });
      const canonKey = canonicalFilmKey({ title: cleanTitle, year, letterboxdUri: uri });
      const uriKey = uri?.trim() ? normalizeLetterboxdFilmUri(uri) : null;

      if (
        (uriKey && ambiguousIdentities.has(uriKey)) ||
        ambiguousIdentities.has(canonKey) ||
        (!uriKey && ambiguousIdentities.has(identityKey))
      ) {
        return null;
      }
      if (uriKey && mediaCache.has(uriKey)) return mediaCache.get(uriKey);
      if (mediaCache.has(canonKey)) return mediaCache.get(canonKey);
      if (!uriKey && mediaCache.has(identityKey)) return mediaCache.get(identityKey);

      // Check pre-resolved identities (prioritizing uriKey and canonKey over loose identityKey)
      const preResolved =
        (uriKey ? resolvedMap.get(uriKey) : null) ||
        resolvedMap.get(canonKey) ||
        (!uriKey ? resolvedMap.get(identityKey) : null);
      if (preResolved) {
        if (preResolved.mediaItem) {
          // Defensive guard: Ensure synthetic preview_* identities can NEVER leak into real import execution!
          if (preResolved.mediaItem.id && String(preResolved.mediaItem.id).startsWith("preview_")) {
            // Reject preview placeholder in real execution and fall through to authoritative DB/TMDB resolution
          } else {
            if (uriKey) mediaCache.set(uriKey, preResolved.mediaItem);
            mediaCache.set(canonKey, preResolved.mediaItem);
            if (!uriKey) {
              mediaCache.set(identityKey, preResolved.mediaItem);
              resolvedMediaMap.set(identityKey, preResolved.mediaItem.id);
            }
            return preResolved.mediaItem;
          }
        }

        if (preResolved.isSyntheticFallback) {
          // Check DB first under transaction lock to prevent duplicate creation
          let existingMedia: any = null;
          if (uriKey) {
            const mapping = await tx.query.importSourceMappings.findFirst({
              where: (m, { and, eq }) =>
                and(eq(m.sourceService, "letterboxd"), eq(m.sourceUri, uriKey)),
              with: { mediaItem: true },
            });
            if (mapping?.mediaItem) {
              existingMedia = mapping.mediaItem;
            } else {
              // Search for an existing media item with matching title & year that is NOT mapped to a different URI
              const candidates = await tx.query.mediaItems.findMany({
                where: (m, { and, eq, isNull }) =>
                  and(
                    sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
                    year
                      ? sql`substring(${m.releaseDate}, 1, 4) = ${String(year)}`
                      : isNull(m.releaseDate),
                  ),
              });
              const nonConflicting: any[] = [];
              for (const c of candidates) {
                const sessionUri = mediaIdToUri.get(c.id);
                if (sessionUri && sessionUri !== uriKey) continue;

                const maps = await tx.query.importSourceMappings.findMany({
                  where: (sm, { and, eq }) =>
                    and(eq(sm.sourceService, "letterboxd"), eq(sm.mediaItemId, c.id)),
                });
                const conflicts = maps.some(
                  (sm) => sm.sourceUri && normalizeLetterboxdFilmUri(sm.sourceUri) !== uriKey
                );
                if (conflicts) continue;

                const existingRatings = await tx.query.ratings.findMany({
                  where: (r, { eq }) => eq(r.mediaItemId, c.id),
                  columns: { letterboxdUri: true },
                });
                const ratingConflict = existingRatings.some(
                  (r) => r.letterboxdUri && normalizeLetterboxdFilmUri(r.letterboxdUri) !== uriKey
                );
                if (ratingConflict) continue;

                nonConflicting.push(c);
              }
              if (nonConflicting.length === 1) {
                existingMedia = nonConflicting[0];
              }
            }
          } else {
            existingMedia = await tx.query.mediaItems.findFirst({
              where: (m, { and, eq, isNull }) =>
                and(
                  sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
                  year
                    ? sql`substring(${m.releaseDate}, 1, 4) = ${String(year)}`
                    : isNull(m.releaseDate),
                ),
            });
          }

          if (existingMedia) {
            if (uriKey) {
              mediaIdToUri.set(existingMedia.id, uriKey);
              mediaCache.set(uriKey, existingMedia);
            }
            mediaCache.set(canonKey, existingMedia);
            if (!uriKey) {
              mediaCache.set(identityKey, existingMedia);
              resolvedMediaMap.set(identityKey, existingMedia.id);
            }
            return existingMedia;
          }

          const fallbackReleaseDate = year ? `${year}-01-01` : null;
          const [fallback] = await tx
            .insert(mediaItems)
            .values({
              id: `media_${randomUUID()}`,
              mediaType: "movie",
              title: cleanTitle,
              releaseDate: fallbackReleaseDate,
            })
            .returning();

          if (uriKey) {
            mediaIdToUri.set(fallback.id, uriKey);
            mediaCache.set(uriKey, fallback);
          }
          mediaCache.set(canonKey, fallback);
          if (!uriKey) {
            mediaCache.set(identityKey, fallback);
            resolvedMediaMap.set(identityKey, fallback.id);
          }
          return fallback;
        }
      }

      // Check pre-resolved quarantines
      const preQuarantined =
        (uriKey ? quarantineMap.get(uriKey) : null) ||
        quarantineMap.get(canonKey) ||
        (!uriKey ? quarantineMap.get(identityKey) : null);
      if (preQuarantined) {
        if (uriKey) ambiguousIdentities.add(uriKey);
        ambiguousIdentities.add(canonKey);
        if (!uriKey) ambiguousIdentities.add(identityKey);
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "film",
          sourceData: { title: cleanTitle, year, uri: uri || null, candidates: preQuarantined.candidates },
          reason: preQuarantined.reason,
          details: preQuarantined.details,
        });
        quarantinedCount++;
        return null;
      }

      // Direct match by user's known rating (matching URI or canonKey, or identityKey if no uriKey)
      if (uriKey && ratingByIdentity.has(uriKey)) {
        const knownRating = ratingByIdentity.get(uriKey);
        if (knownRating?.mediaItem) {
          mediaCache.set(uriKey, knownRating.mediaItem);
          mediaCache.set(canonKey, knownRating.mediaItem);
          return knownRating.mediaItem;
        }
      } else if (!uriKey) {
        const knownRating = ratingByIdentity.get(identityKey);
        if (knownRating?.mediaItem) {
          mediaCache.set(identityKey, knownRating.mediaItem);
          resolvedMediaMap.set(identityKey, knownRating.mediaItem.id);
          return knownRating.mediaItem;
        }
      }

      if (uriKey) {
        const mapping = await tx.query.importSourceMappings.findFirst({
          where: (m, { and, eq }) =>
            and(eq(m.sourceService, "letterboxd"), eq(m.sourceUri, uriKey)),
          with: { mediaItem: true },
        });
        if (mapping?.mediaItem) {
          mediaCache.set(uriKey, mapping.mediaItem);
          mediaCache.set(canonKey, mapping.mediaItem);
          return mapping.mediaItem;
        }
      }

      // Check DB by title and year
      const matchingMedia = await tx.query.mediaItems.findMany({
        where: (m, { and, eq, isNull }) =>
          and(
            sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
            year
              ? sql`substring(${m.releaseDate}, 1, 4) = ${String(year)}`
              : isNull(m.releaseDate),
          ),
      });

      let eligibleMedia = matchingMedia;
      if (uriKey) {
        const nonConflicting: any[] = [];
        for (const c of matchingMedia) {
          const sessionUri = mediaIdToUri.get(c.id);
          if (sessionUri && sessionUri !== uriKey) continue;

          const maps = await tx.query.importSourceMappings.findMany({
            where: (sm, { and, eq }) =>
              and(eq(sm.sourceService, "letterboxd"), eq(sm.mediaItemId, c.id)),
          });
          const conflicts = maps.some(
            (sm) => sm.sourceUri && normalizeLetterboxdFilmUri(sm.sourceUri) !== uriKey
          );
          if (conflicts) continue;

          const existingRatings = await tx.query.ratings.findMany({
            where: (r, { eq }) => eq(r.mediaItemId, c.id),
            columns: { letterboxdUri: true },
          });
          const ratingConflict = existingRatings.some(
            (r) => r.letterboxdUri && normalizeLetterboxdFilmUri(r.letterboxdUri) !== uriKey
          );
          if (ratingConflict) continue;

          nonConflicting.push(c);
        }
        eligibleMedia = nonConflicting;
      }

      if (eligibleMedia.length === 1) {
        mediaCache.set(identityKey, eligibleMedia[0]);
        if (uriKey) {
          mediaIdToUri.set(eligibleMedia[0].id, uriKey);
          mediaCache.set(uriKey, eligibleMedia[0]);
        }
        mediaCache.set(canonKey, eligibleMedia[0]);
        resolvedMediaMap.set(identityKey, eligibleMedia[0].id);
        return eligibleMedia[0];
      }

      if (eligibleMedia.length > 1) {
        ambiguousIdentities.add(identityKey);
        ambiguousIdentities.add(canonKey);
        if (uriKey) ambiguousIdentities.add(uriKey);
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "film",
          sourceData: { title: cleanTitle, year, uri: uri || null },
          reason: "ambiguous_media",
          details: `Multiple (${eligibleMedia.length}) database media records found with identical title "${cleanTitle}" and year ${year}. Quarantined without assignment.`,
        });
        quarantinedCount++;
        return null;
      }

      if (!uriKey && !year) {
        // Check DB by title when no year was provided
        const allMatchingTitle = await tx.query.mediaItems.findMany({
          where: (m) => sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
        });

        if (allMatchingTitle.length > 1) {
          ambiguousIdentities.add(identityKey);
          ambiguousIdentities.add(canonKey);
          await tx.insert(unresolvedImportItems).values({
            id: `unres_${randomUUID()}`,
            userId,
            sourceService: "letterboxd",
            sourceType: "film",
            sourceData: { title: cleanTitle, year: null, uri: uri || null },
            reason: "ambiguous_media",
            details: `Multiple (${allMatchingTitle.length}) database media records found with identical title "${cleanTitle}" but no year provided in export. Quarantined without assignment.`,
          });
          quarantinedCount++;
          return null;
        }
      }

      // If synthetic placeholders are explicitly allowed (e.g. synthetic test suites without external TMDB credentials):
      const hasTmdbCredentials = Boolean(
        process.env.TMDB_API_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY
      );
      const allowSynthetic =
        options?.allowSyntheticPlaceholders ??
        (process.env.AUBREY_ALLOW_SYNTHETIC_MEDIA === "1" ||
          (!hasTmdbCredentials && (process.env.CI === "true" || process.env.AUBREY_TEST_MODE === "1")));
      if (allowSynthetic) {
        const releaseDate = year ? `${year}-01-01` : null;
        const [newMedia] = await tx
          .insert(mediaItems)
          .values({
            id: `media_${randomUUID()}`,
            mediaType: "movie",
            title: cleanTitle,
            releaseDate,
          })
          .returning();

        if (uriKey) {
          mediaIdToUri.set(newMedia.id, uriKey);
          mediaCache.set(uriKey, newMedia);
        }
        mediaCache.set(canonKey, newMedia);
        if (!uriKey) {
          mediaCache.set(identityKey, newMedia);
          resolvedMediaMap.set(identityKey, newMedia.id);
        }
        return newMedia;
      }

      // Otherwise, refuse to create incomplete placeholder records and quarantine cleanly
      if (uriKey) ambiguousIdentities.add(uriKey);
      ambiguousIdentities.add(canonKey);
      if (!uriKey) ambiguousIdentities.add(identityKey);
      await tx.insert(unresolvedImportItems).values({
        id: `unres_${randomUUID()}`,
        userId,
        sourceService: "letterboxd",
        sourceType: "film",
        sourceData: { title: cleanTitle, year, uri: uri || null },
        reason: "unmatched_media",
        details: `No verified TMDB movie or TV identity established for "${cleanTitle}" (${year ?? "no year"}). Placeholder creation prevented.`,
      });
      quarantinedCount++;
      return null;
    };

    let newCount = 0;
    let updatedCount = 0;
    let preservedCount = 0;
    let newReviewsCount = 0;
    let newDiaryCount = 0;
    let updatedDiaryCount = 0;
    let preservedDiaryCount = 0;
    let newWatchlistCount = 0;
    let newListsCount = 0;
    let listEntriesCount = 0;
    let quarantinedCount = 0;

    // ------------------------------------------------------------------
    // STEP 1: Import / Reconcile Films & Ratings
    // ------------------------------------------------------------------
    for (const film of summary.films) {
      const mediaItem = await resolveOrCreateMedia(film.title, film.year, film.letterboxdUri);
      if (!mediaItem) {
        quarantinedCount++;
        continue;
      }

      // Global rating row lock
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, null, mediaItem.id])}, 0))`,
      );
      await tx
        .select({ id: ratings.id })
        .from(ratings)
        .where(
          and(
            eq(ratings.userId, userId),
            eq(ratings.mediaItemId, mediaItem.id),
            isNull(ratings.collectionId),
          ),
        )
        .for("update");

      const existing = await tx.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) =>
          and(
            eq(r.userId, userId),
            eq(r.mediaItemId, mediaItem.id),
            isNull(r.collectionId),
          ),
      });

      // Preserve newer or custom Aubrey ratings/rubrics
      const isAubreyCustomEdit =
        existing &&
        (existing.calculatedOverallScore !== null ||
          existing.tierId !== null ||
          (existing.sourceService !== null && existing.sourceService !== "letterboxd"));

      const watchDate = film.watchDate ? new Date(film.watchDate) : existing?.watchDate ?? null;

      if (existing) {
        if (isAubreyCustomEdit) {
          // Keep existing Aubrey score and rubrics; only update source provenance and watched/favorite flags safely
          await tx
            .update(ratings)
            .set({
              isWatched: film.isWatched ? true : existing.isWatched,
              isFavorite: Boolean(film.isFavorite) || existing.isFavorite,
              letterboxdUri: film.letterboxdUri || existing.letterboxdUri || null,
              watchDate: existing.watchDate || watchDate,
              updatedAt: new Date(),
            })
            .where(and(eq(ratings.id, existing.id), eq(ratings.userId, userId)));
          preservedCount++;
          updatedCount++;
        } else {
          // Standard Letterboxd update
          await tx
            .update(ratings)
            .set({
              sourceScale: 5,
              sourceService: "letterboxd",
              isWatched: film.isWatched ? true : existing.isWatched,
              isFavorite: Boolean(film.isFavorite) || existing.isFavorite,
              sourceRating: film.rating ?? existing.sourceRating ?? null,
              letterboxdUri: film.letterboxdUri || existing.letterboxdUri || null,
              reviewText: existing.reviewText || film.review || null,
              watchDate,
              updatedAt: new Date(),
            })
            .where(and(eq(ratings.id, existing.id), eq(ratings.userId, userId)));
          updatedCount++;
        }
      } else {
        const [insertedRating] = await tx
          .insert(ratings)
          .values({
            id: `rate_${randomUUID()}`,
            userId,
            mediaItemId: mediaItem.id,
            collectionId: null,
            sourceScale: 5,
            sourceService: "letterboxd",
            isWatched: film.isWatched,
            isFavorite: Boolean(film.isFavorite),
            sourceRating: film.rating ?? null,
            letterboxdUri: film.letterboxdUri || null,
            reviewText: film.review || null,
            watchDate,
            createdAt: watchDate || new Date(),
            updatedAt: new Date(),
          })
          .returning();
        const filmCanon = canonicalFilmKey(film);
        ratingByIdentity.set(filmCanon, { ...insertedRating, mediaItem } as any);
        if (film.letterboxdUri) {
          ratingByIdentity.set(normalizeLetterboxdFilmUri(film.letterboxdUri), { ...insertedRating, mediaItem } as any);
        }
        ratingByIdentity.set(filmIdentity(film), { ...insertedRating, mediaItem } as any);
        newCount++;
      }
    }

    // ------------------------------------------------------------------
    // STEP 2: Legacy Letterboxd Review Text Migration (Ratings -> Reviews)
    // ------------------------------------------------------------------
    const legacyRatingsWithReview = await tx.query.ratings.findMany({
      where: (r, { and, eq, isNull }) =>
        and(
          eq(r.userId, userId),
          isNull(r.collectionId),
          eq(r.sourceService, "letterboxd"),
        ),
    });

    for (const r of legacyRatingsWithReview) {
      if (!r.reviewText?.trim()) continue;

      const existingFirstClass = await tx.query.reviews.findFirst({
        where: (rev, { and, eq }) =>
          and(eq(rev.userId, userId), eq(rev.mediaItemId, r.mediaItemId)),
      });

      if (!existingFirstClass) {
        await tx.insert(reviews).values({
          id: `rev_${randomUUID()}`,
          userId,
          mediaItemId: r.mediaItemId,
          ratingId: r.id,
          content: r.reviewText.trim(),
          contentFormat: "plain",
          status: "published",
          visibility: "private", // strictly private
          isJournal: true,
          shareRating: false,
          sourceService: "letterboxd",
          sourceUri: r.letterboxdUri || null,
          publishedAt: r.watchDate || r.createdAt,
          createdAt: r.watchDate || r.createdAt,
          updatedAt: new Date(),
        });
        newReviewsCount++;
      }
    }

    // ------------------------------------------------------------------
    // STEP 3: First-Class Reviews from reviews.csv
    // ------------------------------------------------------------------
    for (const rev of summary.reviews) {
      const mediaItem = await resolveOrCreateMedia(rev.title, rev.year, rev.letterboxdUri);
      if (!mediaItem) {
        // Quarantine dependent review for ambiguous film
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "review",
          sourceData: rev,
          reason: "ambiguous_media",
          details: `Dependent review for film "${rev.title}" (${rev.year ?? "no year"}) quarantined because matching film is ambiguous.`,
        });
        quarantinedCount++;
        continue;
      }

      const existingRev = await tx.query.reviews.findFirst({
        where: (r, { and, eq }) =>
          rev.letterboxdUri
            ? and(
                eq(r.userId, userId),
                eq(r.sourceService, "letterboxd"),
                eq(r.sourceUri, rev.letterboxdUri),
              )
            : and(eq(r.userId, userId), eq(r.mediaItemId, mediaItem.id)),
      });

      const linkedRating = await tx.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) =>
          and(
            eq(r.userId, userId),
            eq(r.mediaItemId, mediaItem.id),
            isNull(r.collectionId),
          ),
      });

      const pubDate = rev.reviewDate
        ? new Date(rev.reviewDate)
        : rev.watchedDate
          ? new Date(rev.watchedDate)
          : new Date();

      if (!existingRev) {
        await tx.insert(reviews).values({
          id: `rev_${randomUUID()}`,
          userId,
          mediaItemId: mediaItem.id,
          ratingId: linkedRating?.id ?? null,
          content: rev.review,
          contentFormat: "markdown",
          status: "published",
          visibility: "private", // strictly private
          isJournal: true,
          shareRating: false,
          sourceService: "letterboxd",
          sourceUri: rev.letterboxdUri || null,
          watchedDate: rev.watchedDate || null,
          tags: rev.tags && rev.tags.length > 0 ? rev.tags : null,
          publishedAt: pubDate,
          createdAt: pubDate,
          updatedAt: new Date(),
        });
        newReviewsCount++;
      } else if (existingRev.sourceService === "letterboxd" && !existingRev.draftContent) {
        // Idempotent update without overwriting Aubrey user edits
        await tx
          .update(reviews)
          .set({
            ratingId: linkedRating?.id ?? existingRev.ratingId,
            watchedDate: rev.watchedDate || existingRev.watchedDate,
            tags: rev.tags && rev.tags.length > 0 ? rev.tags : existingRev.tags,
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, existingRev.id));
      }
    }

    // ------------------------------------------------------------------
    // STEP 4: Individual Diary Viewings & Rewatches from diary.csv
    // ------------------------------------------------------------------
    // Viewing events are separated from film identities: multiple viewings with the
    // same film URI are preserved with distinct viewing dates and rewatch statuses.
    for (const d of summary.diaryEntries) {
      const mediaItem = await resolveOrCreateMedia(d.title, d.year, d.letterboxdUri);
      if (!mediaItem) {
        // Quarantine dependent diary entry for ambiguous film
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "diary",
          sourceData: d,
          reason: "ambiguous_media",
          details: `Dependent diary entry for film "${d.title}" (${d.year ?? "no year"}) quarantined because matching film is ambiguous.`,
        });
        quarantinedCount++;
        continue;
      }

      // Generate stable viewing-event key to guarantee repeat-import idempotency and update stability
      const eventKey = d.sourceEventKey || buildDiaryEventKey(d);

      const existingDiary = await tx.query.diaryEntries.findFirst({
        where: (entry, { and, eq }) =>
          and(
            eq(entry.userId, userId),
            eq(entry.sourceEventKey, eventKey),
          ),
      });

      if (!existingDiary) {
        const linkedRating = await tx.query.ratings.findFirst({
          where: (r, { and, eq, isNull }) =>
            and(
              eq(r.userId, userId),
              eq(r.mediaItemId, mediaItem.id),
              isNull(r.collectionId),
            ),
        });

        const linkedReview = await tx.query.reviews.findFirst({
          where: (r, { and, eq }) =>
            and(eq(r.userId, userId), eq(r.mediaItemId, mediaItem.id)),
        });

        await tx.insert(diaryEntries).values({
          id: `diary_${randomUUID()}`,
          userId,
          mediaItemId: mediaItem.id,
          ratingId: linkedRating?.id ?? null,
          reviewId: linkedReview?.id ?? null,
          watchedDate: d.watchedDate,
          loggedDate: d.loggedDate ? new Date(d.loggedDate) : null,
          isRewatch: d.isRewatch,
          ratingValue: typeof d.rating === "number" ? d.rating * 2 : null,
          sourceRating: d.rating ?? null,
          sourceScale: typeof d.rating === "number" ? 5 : null,
          tags: d.tags && d.tags.length > 0 ? d.tags : null,
          sourceService: "letterboxd",
          sourceUri: d.letterboxdUri || null, // preserve film URI for provenance
          sourceEventKey: eventKey, // unique viewing event key
          createdAt: d.watchedDate ? new Date(d.watchedDate) : new Date(),
          updatedAt: new Date(),
        });
        newDiaryCount++;
      } else {
        // Legitimate reimport or update: check if rating or tags changed in Letterboxd
        const expectedScore = typeof d.rating === "number" ? d.rating * 2 : null;
        const ratingChanged =
          expectedScore !== existingDiary.ratingValue ||
          (d.rating ?? null) !== existingDiary.sourceRating;
        const currentTags = (existingDiary.tags as string[]) || [];
        const newTags = d.tags || [];
        const tagsChanged =
          currentTags.slice().sort().join(",") !== newTags.slice().sort().join(",");

        if (ratingChanged || tagsChanged) {
          await tx
            .update(diaryEntries)
            .set({
              ratingValue: typeof d.rating === "number" ? d.rating * 2 : existingDiary.ratingValue,
              sourceRating: d.rating ?? existingDiary.sourceRating,
              sourceScale: typeof d.rating === "number" ? 5 : existingDiary.sourceScale,
              tags: newTags.length > 0 ? newTags : null,
              updatedAt: new Date(),
            })
            .where(eq(diaryEntries.id, existingDiary.id));
          updatedDiaryCount++;
        } else {
          preservedDiaryCount++;
        }
      }
    }

    // ------------------------------------------------------------------
    // STEP 5: Watchlist from watchlist.csv
    // ------------------------------------------------------------------
    for (const w of summary.watchlist) {
      const mediaItem = await resolveOrCreateMedia(w.title, w.year, w.letterboxdUri);
      if (!mediaItem) {
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "watchlist",
          sourceData: w,
          reason: "ambiguous_media",
          details: `Dependent watchlist item for film "${w.title}" (${w.year ?? "no year"}) quarantined because matching film is ambiguous.`,
        });
        quarantinedCount++;
        continue;
      }

      const existingWl = await tx.query.watchlistItems.findFirst({
        where: (item, { and, eq }) =>
          and(eq(item.userId, userId), eq(item.mediaItemId, mediaItem.id)),
      });

      if (!existingWl) {
        await tx.insert(watchlistItems).values({
          id: `wl_${randomUUID()}`,
          userId,
          mediaItemId: mediaItem.id,
          createdAt: w.dateAdded ? new Date(w.dateAdded) : new Date(),
          updatedAt: new Date(),
        });
        newWatchlistCount++;
      }
    }

    // ------------------------------------------------------------------
    // STEP 6: Custom Lists from lists/*.csv
    // ------------------------------------------------------------------
    for (const list of summary.customLists) {
      let col = await tx.query.collections.findFirst({
        where: (c, { and, eq }) =>
          list.url
            ? and(
                eq(c.userId, userId),
                eq(c.sourceService, "letterboxd"),
                eq(c.sourceUri, list.url),
              )
            : and(
                eq(c.userId, userId),
                eq(c.title, list.title),
                eq(c.sourceService, "letterboxd"),
              ),
      });

      if (!col) {
        const [newCol] = await tx
          .insert(collections)
          .values({
            id: `col_${randomUUID()}`,
            userId,
            title: list.title,
            description: list.description || null,
            collectionType: "custom",
            isRanked: false, // ordinary list, distinct from weighted rankings
            isPublic: false,
            visibility: "private", // strictly private
            sourceService: "letterboxd",
            sourceUri: list.url || null,
            tags: list.tags && list.tags.length > 0 ? list.tags : null,
          })
          .returning();
        col = newCol;
        newListsCount++;
      } else {
        if ((list.tags && list.tags.length > 0) || list.description) {
          await tx
            .update(collections)
            .set({
              tags: list.tags && list.tags.length > 0 ? list.tags : col.tags,
              description: list.description || col.description,
              updatedAt: new Date(),
            })
            .where(eq(collections.id, col.id));
        }
      }

      for (const entry of list.entries) {
        const mediaItem = await resolveOrCreateMedia(entry.title, entry.year, entry.letterboxdUri);
        if (!mediaItem) {
          await tx.insert(unresolvedImportItems).values({
            id: `unres_${randomUUID()}`,
            userId,
            sourceService: "letterboxd",
            sourceType: "list",
            sourceData: { listTitle: list.title, entry },
            reason: "ambiguous_media",
            details: `List entry position ${entry.position} for film "${entry.title}" in list "${list.title}" quarantined because matching film is ambiguous.`,
          });
          quarantinedCount++;
          continue;
        }

        const existingEntry = await tx.query.collectionEntries.findFirst({
          where: (e, { and, eq }) =>
            and(eq(e.collectionId, col.id), eq(e.mediaItemId, mediaItem.id)),
        });

        if (!existingEntry) {
          await tx.insert(collectionEntries).values({
            id: `centry_${randomUUID()}`,
            collectionId: col.id,
            mediaItemId: mediaItem.id,
            sortOrder: entry.position,
            notes: entry.notes || null,
          });
          listEntriesCount++;
        }
      }
    }

    // ------------------------------------------------------------------
    // STEP 7: Persist Malformed Rows & Unsupported Archive Items
    // ------------------------------------------------------------------
    for (const unres of summary.unresolved) {
      await tx.insert(unresolvedImportItems).values({
        id: `unres_${randomUUID()}`,
        userId,
        sourceService: "letterboxd",
        sourceType: unres.sourceType,
        sourceData: unres.rawRow,
        reason: unres.reason,
        details: unres.details || null,
      });
      quarantinedCount++;
    }

    for (const unsupp of summary.unsupportedItems || []) {
      await tx.insert(unresolvedImportItems).values({
        id: `unres_${randomUUID()}`,
        userId,
        sourceService: "letterboxd",
        sourceType: "unsupported",
        sourceData: { filename: unsupp.filename, count: unsupp.count },
        reason: unsupp.category,
        details: unsupp.details,
      });
    }

    if (Array.isArray(input)) {
      return { newCount, updatedCount };
    }

    const totalUnresolvedAndQuarantined = quarantinedCount;
    const unsupportedNotice =
      summary.unsupportedItems && summary.unsupportedItems.length > 0
        ? ` Note: ${summary.unsupportedItems.length} external/unsupported files (${summary.unsupportedItems.map((u) => u.filename).join(", ")}) were reported and not imported into your library.`
        : "";

    const quarantineNotice =
      quarantinedCount > 0
        ? ` ${quarantinedCount} entries with ambiguous matches or missing metadata were quarantined in your unresolved import log for review.`
        : "";

    const message = `Processed ${summary.films.length} films (${newCount} new, ${updatedCount} updated, ${preservedCount} preserved Aubrey edits). Added ${newDiaryCount} viewing logs, ${newReviewsCount} private reviews, ${newWatchlistCount} watchlist items, and ${newListsCount} custom lists.${quarantineNotice}${unsupportedNotice}`;

    return {
      newCount,
      updatedCount,
      preservedCount,
      newReviewsCount,
      newDiaryCount,
      updatedDiaryCount,
      preservedDiaryCount,
      newWatchlistCount,
      newListsCount,
      listEntriesCount,
      unresolvedCount: totalUnresolvedAndQuarantined,
      importedTotal: summary.films.length,
      message,
      reconciliation: {
        films: { total: summary.films.length, new: newCount, updated: updatedCount, preserved: preservedCount },
        reviews: { total: summary.reviews.length, created: newReviewsCount },
        diary: { total: summary.diaryEntries.length, created: newDiaryCount, updated: updatedDiaryCount, preserved: preservedDiaryCount },
        watchlist: { total: summary.watchlist.length, created: newWatchlistCount },
        lists: { total: summary.customLists.length, created: newListsCount, entries: listEntriesCount },
        unresolvedCount: totalUnresolvedAndQuarantined,
        unsupportedItems: summary.unsupportedItems || [],
      },
    };
  });
}
