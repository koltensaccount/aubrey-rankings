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
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  LetterboxdExportSummary,
  ParsedLetterboxdFilm,
} from "./letterboxd";

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
) {
  const summary = normalizeSummary(input);

  // 1. Existing global ratings
  const existingRatings = await db.query.ratings.findMany({
    where: (r, { and, eq, isNull }) =>
      and(eq(r.userId, userId), isNull(r.collectionId)),
    with: { mediaItem: true },
  });

  const existingRatingKeys = new Set(
    existingRatings
      .filter((r) => r.mediaItem.mediaType === "movie")
      .map((r) =>
        filmIdentity({
          title: r.mediaItem.title,
          year: r.mediaItem.releaseDate
            ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
            : null,
        }),
      ),
  );

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
    columns: { id: true, mediaItemId: true },
  });

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

  const existingCount = summary.films.filter((film) =>
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
    // Generate sample event key for preview comparison
    const sig = `${d.title.toLowerCase()}::${d.year ?? ""}::${d.watchedDate || ""}::${d.loggedDate || ""}::${d.isRewatch}::${d.rating ?? ""}::${(d.tags || []).slice().sort().join(",")}::${d.occurrenceIndex || 1}`;
    return !existingDiaryEventKeys.has(sig);
  }).length;

  const newWatchlistCount = summary.watchlist.length;

  const newListsCount = summary.customLists.filter(
    (l) =>
      (!l.url || !existingListUris.has(l.url)) &&
      !existingListTitles.has(l.title.trim().toLowerCase()),
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
        new: summary.totalRatings,
        existing: existingCount,
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
        existing: existingWatchlist.length,
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
) {
  const summary = normalizeSummary(input);

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

    const ratingByIdentity = new Map(
      userRatings
        .filter((r) => r.mediaItem.mediaType === "movie")
        .map((r) => [
          filmIdentity({
            title: r.mediaItem.title,
            year: r.mediaItem.releaseDate
              ? Number(r.mediaItem.releaseDate.slice(0, 4)) || null
              : null,
          }),
          r,
        ]),
    );

    // Media cache for fast resolution during transaction
    const mediaCache = new Map<string, any>();
    const resolvedMediaMap = new Map<string, string>(); // film identity -> media_item_id
    const ambiguousIdentities = new Set<string>();

    /**
     * Resolves or creates a media item with verified identity matching.
     * If multiple matches exist and cannot be distinguished, it returns null
     * and quarantines the record to prevent arbitrary assignment.
     */
    const resolveOrCreateMedia = async (
      title: string,
      year: number | null,
      uri?: string,
    ) => {
      const cleanTitle = title.trim();
      const identityKey = filmIdentity({ title: cleanTitle, year });

      if (ambiguousIdentities.has(identityKey)) return null;
      if (mediaCache.has(identityKey)) return mediaCache.get(identityKey);

      // 1. Verified source identity matching: if URI is provided and an existing rating has it
      if (uri?.trim()) {
        const verifiedRating = await tx.query.ratings.findFirst({
          where: (r, { and, eq, isNotNull }) =>
            and(eq(r.letterboxdUri, uri.trim()), isNotNull(r.letterboxdUri)),
          with: { mediaItem: true },
        });
        if (verifiedRating?.mediaItem) {
          mediaCache.set(identityKey, verifiedRating.mediaItem);
          resolvedMediaMap.set(identityKey, verifiedRating.mediaItem.id);
          return verifiedRating.mediaItem;
        }
      }

      // 2. Direct match by user's known rating
      const knownRating = ratingByIdentity.get(identityKey);
      if (knownRating?.mediaItem) {
        mediaCache.set(identityKey, knownRating.mediaItem);
        resolvedMediaMap.set(identityKey, knownRating.mediaItem.id);
        return knownRating.mediaItem;
      }

      // 3. Query DB by title and release year
      const matchingMedia = await tx.query.mediaItems.findMany({
        where: (m, { and, eq, isNull }) =>
          and(
            eq(m.mediaType, "movie"),
            sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
            year
              ? sql`substring(${m.releaseDate}, 1, 4) = ${String(year)}`
              : isNull(m.releaseDate),
          ),
      });

      // Guard: Ambiguous match with multiple identical title & year records
      if (matchingMedia.length > 1) {
        ambiguousIdentities.add(identityKey);
        await tx.insert(unresolvedImportItems).values({
          id: `unres_${randomUUID()}`,
          userId,
          sourceService: "letterboxd",
          sourceType: "film",
          sourceData: { title: cleanTitle, year, uri: uri || null },
          reason: "ambiguous_media",
          details: `Multiple (${matchingMedia.length}) database media records found with identical title "${cleanTitle}" and year ${year}. Quarantined without assignment.`,
        });
        return null;
      }

      // Guard: Year was omitted in export row, but database has multiple movies with this title
      if (!year) {
        const anyYearMatches = await tx.query.mediaItems.findMany({
          where: (m, { and, eq }) =>
            and(
              eq(m.mediaType, "movie"),
              sql`lower(trim(${m.title})) = lower(${cleanTitle})`,
            ),
        });
        if (anyYearMatches.length > 1) {
          ambiguousIdentities.add(identityKey);
          await tx.insert(unresolvedImportItems).values({
            id: `unres_${randomUUID()}`,
            userId,
            sourceService: "letterboxd",
            sourceType: "film",
            sourceData: { title: cleanTitle, year: null, uri: uri || null },
            reason: "ambiguous_media",
            details: `Title "${cleanTitle}" matches multiple existing films with different years (${anyYearMatches.map((m) => m.releaseDate ? m.releaseDate.slice(0, 4) : 'unknown').join(', ')}) but export row specified no year. Quarantined without assignment.`,
          });
          return null;
        }
        if (anyYearMatches.length === 1) {
          mediaCache.set(identityKey, anyYearMatches[0]);
          resolvedMediaMap.set(identityKey, anyYearMatches[0].id);
          return anyYearMatches[0];
        }
      }

      if (matchingMedia.length === 1) {
        mediaCache.set(identityKey, matchingMedia[0]);
        resolvedMediaMap.set(identityKey, matchingMedia[0].id);
        return matchingMedia[0];
      }

      // 4. Create new media item record
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

      mediaCache.set(identityKey, newMedia);
      resolvedMediaMap.set(identityKey, newMedia.id);
      return newMedia;
    };

    let newCount = 0;
    let updatedCount = 0;
    let preservedCount = 0;
    let newReviewsCount = 0;
    let newDiaryCount = 0;
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

      // Generate stable viewing-event key to guarantee repeat-import idempotency
      const baseSignature = `${mediaItem.id}::${d.watchedDate || ""}::${d.loggedDate || ""}::${d.isRewatch}::${d.rating ?? ""}::${(d.tags || []).slice().sort().join(",")}`;
      const eventKey = `${baseSignature}::${d.occurrenceIndex || 1}`;

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
          ratingValue: d.rating ?? null,
          tags: d.tags.length > 0 ? d.tags : null,
          sourceService: "letterboxd",
          sourceUri: d.letterboxdUri || null, // preserve film URI for provenance
          sourceEventKey: eventKey, // unique viewing event key
          createdAt: d.watchedDate ? new Date(d.watchedDate) : new Date(),
          updatedAt: new Date(),
        });
        newDiaryCount++;
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
          })
          .returning();
        col = newCol;
        newListsCount++;
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
    const message =
      totalUnresolvedAndQuarantined > 0
        ? `Processed ${summary.films.length} films (${newCount} new, ${updatedCount} updated, ${preservedCount} preserved Aubrey edits). Added ${newDiaryCount} viewing logs, ${newReviewsCount} private reviews, ${newWatchlistCount} watchlist items, and ${newListsCount} lists. ${totalUnresolvedAndQuarantined} items were quarantined as ambiguous or unmapped.`
        : `Successfully processed ${summary.films.length} films (${newCount} new, ${updatedCount} updated, ${preservedCount} preserved Aubrey edits). Added ${newDiaryCount} viewing logs, ${newReviewsCount} private reviews, ${newWatchlistCount} watchlist items, and ${newListsCount} lists.`;

    return {
      newCount,
      updatedCount,
      preservedCount,
      newReviewsCount,
      newDiaryCount,
      newWatchlistCount,
      newListsCount,
      listEntriesCount,
      unresolvedCount: totalUnresolvedAndQuarantined,
      importedTotal: summary.films.length,
      message,
      reconciliation: {
        films: { total: summary.films.length, new: newCount, updated: updatedCount, preserved: preservedCount },
        reviews: { total: summary.reviews.length, created: newReviewsCount },
        diary: { total: summary.diaryEntries.length, created: newDiaryCount },
        watchlist: { total: summary.watchlist.length, created: newWatchlistCount },
        lists: { total: summary.customLists.length, created: newListsCount, entries: listEntriesCount },
        unresolvedCount: totalUnresolvedAndQuarantined,
        unsupportedItems: summary.unsupportedItems || [],
      },
    };
  });
}
