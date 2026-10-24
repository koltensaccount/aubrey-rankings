import { db } from "@/db";
import {
  activityEvents,
  diaryEntries,
  reviews,
  ratings,
  watchlistItems,
  mediaItems,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { ActivityDatabase } from "@/lib/activity-sync";

export type ActivityFilter =
  | "all"
  | "viewings"
  | "reviews"
  | "ratings"
  | "watchlist"
  | "films"
  | "tv"
  | "rewatches";

export interface UnifiedTimelineCardData {
  id: string;
  userId: string;
  mediaItemId: string;
  eventType: "viewing" | "review" | "rating" | "watchlist" | "watched_mark" | "viewing_and_review";
  eventDate: string | null; // YYYY-MM-DD
  loggedDate?: Date | string | null;
  diaryEntryId?: string | null;
  reviewId?: string | null;
  ratingId?: string | null;
  watchlistItemId?: string | null;
  mediaItem: {
    id: string;
    title: string;
    year?: number | null;
    releaseDate?: string | null;
    mediaType?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    posterPath?: string | null;
    stillPath?: string | null;
  };
  ratingValue?: number | null; // scale 0-10
  sourceRating?: number | null; // e.g. 4.5
  sourceScale?: number | null; // e.g. 5
  isRewatch?: boolean;
  notes?: string | null;
  reviewContent?: string | null;
  reviewTitle?: string | null;
  reviewVisibility?: string | null;
  reviewIsSpoiler?: boolean;
  ordinal?: number;
  totalViewings?: number;
  badgeLabel?: string;
  createdAt: Date | string;
}

/**
 * Idempotently backfills missing activityEvents for existing records
 * belonging to a user (e.g. historical data created prior to Phase 15B).
 */
export async function backfillUserActivityEvents(
  userId: string,
  txOrDb: ActivityDatabase = db
): Promise<void> {
  // 0. Clean up any orphaned activity events where underlying source record was deleted
  await txOrDb.execute(sql`
    DELETE FROM activity_events
    WHERE user_id = ${userId}
      AND (
        (event_type = 'viewing' AND diary_entry_id IS NOT NULL AND diary_entry_id NOT IN (SELECT id FROM diary_entries WHERE user_id = ${userId}))
        OR (event_type = 'review' AND review_id IS NOT NULL AND review_id NOT IN (SELECT id FROM reviews WHERE user_id = ${userId} AND status = 'published'))
        OR (event_type = 'watchlist' AND watchlist_item_id IS NOT NULL AND watchlist_item_id NOT IN (SELECT id FROM watchlist_items WHERE user_id = ${userId}))
      )
  `);

  const existingEvents = await txOrDb.query.activityEvents.findMany({ where: eq(activityEvents.userId, userId) });
  const viewingEvents = new Map(existingEvents.filter((a) => a.eventType === "viewing").map((a) => [a.diaryEntryId, a]));
  const reviewEvents = new Map(existingEvents.filter((a) => a.eventType === "review").map((a) => [a.reviewId, a]));
  const watchlistEvents = new Map(existingEvents.filter((a) => a.eventType === "watchlist").map((a) => [a.watchlistItemId, a]));

  // 1. Backfill from diary entries
  const userDiaries = await txOrDb.query.diaryEntries.findMany({
    where: eq(diaryEntries.userId, userId),
  });

  for (const d of userDiaries) {
    const key = d.sourceEventKey || `diary:${d.id}`;
    const existing = viewingEvents.get(d.id);

    if (existing) {
      if (
        existing.eventDate !== (d.watchedDate || null) ||
        existing.ratingValue !== d.ratingValue ||
        existing.sourceRating !== d.sourceRating ||
        existing.isRewatch !== d.isRewatch ||
        existing.notes !== d.notes || existing.reviewId !== d.reviewId || existing.sourceScale !== d.sourceScale
      ) {
        await txOrDb
          .update(activityEvents)
          .set({
            eventDate: d.watchedDate || null,
            ratingValue: d.ratingValue,
            sourceRating: d.sourceRating,
            reviewId: d.reviewId,
            sourceScale: d.sourceScale,
            isRewatch: d.isRewatch,
            notes: d.notes,
            updatedAt: new Date(),
          })
          .where(eq(activityEvents.id, existing.id));
      }
    } else {
      await txOrDb
        .insert(activityEvents)
        .values({
          id: `act_${randomUUID()}`,
          userId,
          mediaItemId: d.mediaItemId,
          eventType: "viewing",
          eventDate: d.watchedDate || null,
          loggedDate: d.loggedDate || null,
          diaryEntryId: d.id,
          reviewId: d.reviewId || null,
          ratingId: d.ratingId || null,
          ratingValue: d.ratingValue,
          sourceRating: d.sourceRating,
          sourceScale: d.sourceScale,
          isRewatch: d.isRewatch,
          notes: d.notes,
          sourceService: d.sourceService,
          sourceUri: d.sourceUri,
          sourceEventKey: key,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })
        .onConflictDoNothing();
    }
  }

  // 2. Backfill from published reviews
  const userReviews = await txOrDb.query.reviews.findMany({
    where: and(eq(reviews.userId, userId), eq(reviews.status, "published")),
  });

  for (const r of userReviews) {
    const key = `rev:${r.id}`;
    // Genuine review/activity date: strictly published date, never substituted with viewing/watched date or import timestamp
    const pubDate = r.sourceService === "letterboxd" ? r.sourceReviewDate : r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : null;
    const eventDate = pubDate;

    const existing = reviewEvents.get(r.id);

    if (existing) {
      if (
        existing.eventDate !== eventDate ||
        existing.ratingValue !== r.ratingValue ||
        existing.sourceRating !== r.sourceRating || existing.diaryEntryId !== r.viewingId || existing.sourceScale !== r.sourceScale
      ) {
        await txOrDb
          .update(activityEvents)
          .set({
            eventDate,
            diaryEntryId: r.viewingId,
            ratingValue: r.ratingValue,
            sourceRating: r.sourceRating,
            sourceScale: r.sourceScale,
            updatedAt: new Date(),
          })
          .where(eq(activityEvents.id, existing.id));
      }
    } else {
      await txOrDb
        .insert(activityEvents)
        .values({
          id: `act_${randomUUID()}`,
          userId,
          mediaItemId: r.mediaItemId,
          eventType: "review",
          eventDate,
          loggedDate: r.publishedAt || null,
          reviewId: r.id,
          ratingId: r.ratingId || null,
          diaryEntryId: r.viewingId || null,
          ratingValue: r.ratingValue,
          sourceRating: r.sourceRating,
          sourceScale: r.sourceScale,
          sourceService: r.sourceService,
          sourceUri: r.sourceUri,
          sourceEventKey: key,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })
        .onConflictDoNothing();
    }
  }

  // 3. Backfill from watchlist items
  const userWl = await txOrDb.query.watchlistItems.findMany({
    where: eq(watchlistItems.userId, userId),
  });

  for (const w of userWl) {
    const key = `wl:${w.id}`;
    const dateAdded = w.sourceService ? w.sourceAddedDate : w.createdAt ? w.createdAt.toISOString().slice(0, 10) : null;

    const existing = watchlistEvents.get(w.id);

    if (existing) {
      if (existing.eventDate !== dateAdded) {
        await txOrDb
          .update(activityEvents)
          .set({
            eventDate: dateAdded,
            updatedAt: new Date(),
          })
          .where(eq(activityEvents.id, existing.id));
      }
    } else {
      await txOrDb
        .insert(activityEvents)
        .values({
          id: `act_${randomUUID()}`,
          userId,
          mediaItemId: w.mediaItemId,
          eventType: "watchlist",
          eventDate: dateAdded,
          watchlistItemId: w.id,
          notes: w.notes,
          sourceEventKey: key,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })
        .onConflictDoNothing();
    }
  }
  // Legacy standalone ratings have no verified historical scoring date. Keep
  // their scores/status accessible as undated activity, never borrow watchDate.
  await txOrDb.execute(sql`
    INSERT INTO activity_events (id, user_id, media_item_id, event_type, event_date, rating_id, rating_value, source_event_key, created_at, updated_at)
    SELECT 'act_backfill_rating_' || r.id, r.user_id, r.media_item_id,
      CASE WHEN r.calculated_overall_score IS NOT NULL OR r.tier_id IS NOT NULL THEN 'rating' ELSE 'watched_mark' END,
      NULL, r.id, r.calculated_overall_score, 'rating:' || r.id, r.created_at, r.updated_at
    FROM ratings r WHERE r.user_id = ${userId} AND r.collection_id IS NULL AND r.source_service IS NULL
      AND (r.calculated_overall_score IS NOT NULL OR r.tier_id IS NOT NULL OR r.is_watched)
      AND NOT EXISTS (SELECT 1 FROM activity_events a WHERE a.user_id = r.user_id AND a.rating_id = r.id AND a.event_type IN ('rating', 'watched_mark'))
      AND (r.calculated_overall_score IS NOT NULL OR r.tier_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM diary_entries d WHERE d.user_id = r.user_id AND d.media_item_id = r.media_item_id))
    ON CONFLICT DO NOTHING
  `);

}

/**
 * Combines viewing events and review events that occur on the same date for the same title,
 * while preserving distinct rewatches, separate-date events, and independent activities.
 */
export function combineChronologicalActivities(
  activities: Array<any>,
  mediaOrdinalsMap: Map<string, number> = new Map(),
  mediaTotalsMap: Map<string, number> = new Map()
): {
  datedItems: UnifiedTimelineCardData[];
  undatedItems: UnifiedTimelineCardData[];
} {
  const datedItems: UnifiedTimelineCardData[] = [];
  const undatedItems: UnifiedTimelineCardData[] = [];

  // Index reviews by (mediaItemId, eventDate) and by reviewId for combination
  const reviewByMediaAndDate = new Map<string, any[]>();
  const reviewById = new Map<string, any>();
  const viewingById = new Map<string, any>();

  for (const act of activities) {
    if (act.eventType === "review") {
      reviewById.set(act.reviewId || act.id, act);
      if (act.eventDate) {
        const key = `${act.mediaItemId}::${act.eventDate}`;
        if (!reviewByMediaAndDate.has(key)) reviewByMediaAndDate.set(key, []);
        reviewByMediaAndDate.get(key)!.push(act);
      }
    } else if (act.eventType === "viewing") {
      viewingById.set(act.diaryEntryId || act.id, act);
    }
  }

  const consumedReviewIds = new Set<string>();

  // Process viewings first, attempting same-day combination
  for (const act of activities) {
    if (act.eventType !== "viewing") continue;

    const mediaId = act.mediaItemId;
    const date = act.eventDate;
    let matchingReview: any = null;

    // Check direct link via reviewId or viewingId
    if (act.reviewId && reviewById.has(act.reviewId) && !consumedReviewIds.has(act.reviewId)) {
      const candidate = reviewById.get(act.reviewId);
      // Explicitly linked reviews written on different days must remain separate chronological activities!
      if (candidate && candidate.eventDate && act.eventDate && candidate.eventDate === act.eventDate) {
        matchingReview = candidate;
      }
    } else if (date) {
      // Check same-day review for the same media item ONLY if legitimately associated
      // (matching viewingId/diaryEntryId)
      const key = `${mediaId}::${date}`;
      const candidates = reviewByMediaAndDate.get(key) || [];
      const unconsumed = candidates.find((r) => {
        if (consumedReviewIds.has(r.reviewId || r.id)) return false;
        const isExplicitlyLinked =
          r.diaryEntryId === (act.diaryEntryId || act.id) ||
          act.reviewId === (r.reviewId || r.id);
        return isExplicitlyLinked;
      });
      if (unconsumed) {
        matchingReview = unconsumed;
      }
    }

    const ordinal = mediaOrdinalsMap.get(act.diaryEntryId || act.id) ?? 1;
    const totalViewings = mediaTotalsMap.get(mediaId) ?? 1;
    const isRewatch = Boolean(act.isRewatch || ordinal > 1);

    const ordinalSuffix =
      ordinal === 1 ? "1st" : ordinal === 2 ? "2nd" : ordinal === 3 ? "3rd" : `${ordinal}th`;

    let badgeLabel = isRewatch
      ? (totalViewings > 1 && ordinal > 1 ? `Rewatch · ${ordinalSuffix} Viewing` : "Rewatch")
      : "1st Logged Viewing";

    if (matchingReview) {
      consumedReviewIds.add(matchingReview.reviewId || matchingReview.id);
      badgeLabel = `${badgeLabel} & Reviewed`;

      const combinedCard: UnifiedTimelineCardData = {
        id: `comb_${act.id}_${matchingReview.id}`,
        userId: act.userId,
        mediaItemId: mediaId,
        eventType: "viewing_and_review",
        eventDate: date,
        loggedDate: act.loggedDate,
        diaryEntryId: act.diaryEntryId,
        reviewId: matchingReview.reviewId || matchingReview.id,
        mediaItem: act.mediaItem,
        ratingValue: act.ratingValue ?? matchingReview.ratingValue ?? null,
        sourceRating: act.sourceRating ?? matchingReview.sourceRating ?? null,
        sourceScale: act.sourceScale ?? matchingReview.sourceScale ?? null,
        isRewatch,
        notes: act.notes,
        reviewContent: matchingReview.review?.content ?? matchingReview.reviewContent,
        reviewTitle: matchingReview.review?.title || matchingReview.reviewTitle,
        reviewVisibility: matchingReview.review?.visibility || matchingReview.reviewVisibility || "private",
        reviewIsSpoiler: Boolean(matchingReview.review?.isSpoiler ?? matchingReview.reviewIsSpoiler),
        ordinal,
        totalViewings,
        badgeLabel,
        createdAt: act.createdAt,
      };

      if (date) datedItems.push(combinedCard);
      else undatedItems.push(combinedCard);
    } else {
      const viewingCard: UnifiedTimelineCardData = {
        id: act.id,
        userId: act.userId,
        mediaItemId: mediaId,
        eventType: "viewing",
        eventDate: date,
        loggedDate: act.loggedDate,
        diaryEntryId: act.diaryEntryId,
        mediaItem: act.mediaItem,
        ratingValue: act.ratingValue,
        sourceRating: act.sourceRating,
        sourceScale: act.sourceScale,
        isRewatch,
        notes: act.notes,
        ordinal,
        totalViewings,
        badgeLabel,
        createdAt: act.createdAt,
      };

      if (date) datedItems.push(viewingCard);
      else undatedItems.push(viewingCard);
    }
  }

  // Process remaining uncombined reviews, ratings, watchlist, and watched marks
  for (const act of activities) {
    if (act.eventType === "viewing") continue;

    if (act.eventType === "review") {
      const revId = act.reviewId || act.id;
      if (consumedReviewIds.has(revId)) continue; // already combined with viewing

      const card: UnifiedTimelineCardData = {
        id: act.id,
        userId: act.userId,
        mediaItemId: act.mediaItemId,
        eventType: "review",
        eventDate: act.eventDate,
        loggedDate: act.loggedDate,
        reviewId: revId,
        mediaItem: act.mediaItem,
        ratingValue: act.ratingValue,
        sourceRating: act.sourceRating,
        sourceScale: act.sourceScale,
        reviewContent: act.review?.content ?? act.reviewContent,
        reviewTitle: act.review?.title || act.reviewTitle,
        reviewVisibility: act.review?.visibility || act.reviewVisibility || "private",
        reviewIsSpoiler: Boolean(act.review?.isSpoiler ?? act.reviewIsSpoiler),
        badgeLabel: "Review Logged",
        createdAt: act.createdAt,
      };

      if (act.eventDate) datedItems.push(card);
      else undatedItems.push(card);
    } else if (act.eventType === "rating") {
      const card: UnifiedTimelineCardData = {
        id: act.id,
        userId: act.userId,
        mediaItemId: act.mediaItemId,
        eventType: "rating",
        eventDate: act.eventDate,
        ratingId: act.ratingId,
        mediaItem: act.mediaItem,
        ratingValue: act.ratingValue,
        sourceRating: act.sourceRating,
        sourceScale: act.sourceScale,
        badgeLabel: "Rated",
        createdAt: act.createdAt,
      };
      if (act.eventDate) datedItems.push(card);
      else undatedItems.push(card);
    } else if (act.eventType === "watchlist") {
      const card: UnifiedTimelineCardData = {
        id: act.id,
        userId: act.userId,
        mediaItemId: act.mediaItemId,
        eventType: "watchlist",
        eventDate: act.eventDate,
        watchlistItemId: act.watchlistItemId,
        mediaItem: act.mediaItem,
        badgeLabel: "Added to Watchlist",
        createdAt: act.createdAt,
      };
      if (act.eventDate) datedItems.push(card);
      else undatedItems.push(card);
    } else if (act.eventType === "watched_mark") {
      const card: UnifiedTimelineCardData = {
        id: act.id,
        userId: act.userId,
        mediaItemId: act.mediaItemId,
        eventType: "watched_mark",
        eventDate: act.eventDate,
        mediaItem: act.mediaItem,
        badgeLabel: "Marked Watched",
        createdAt: act.createdAt,
      };
      if (act.eventDate) datedItems.push(card);
      else undatedItems.push(card);
    }
  }

  // Sort dated items in strict reverse chronological order (newest date first)
  datedItems.sort((a, b) => {
    if (a.eventDate && b.eventDate && a.eventDate !== b.eventDate) {
      return b.eventDate.localeCompare(a.eventDate);
    }
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime || b.id.localeCompare(a.id);
  });

  return { datedItems, undatedItems };
}

/**
 * Fetches and returns paginated, unified chronological activities for a user.
 * Guarantees identical normalization, combination, filtering, and stable offsets.
 */
export async function getUserUnifiedTimeline(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    filter?: ActivityFilter;
  } = {},
  txOrDb: ActivityDatabase = db
): Promise<{
  entries: UnifiedTimelineCardData[];
  totalCount: number;
  hasMore: boolean;
  undatedEntries: UnifiedTimelineCardData[];
}> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const filter = options.filter || "all";

  // Reads never repair history. Reconciliation is an explicit maintenance action.
  // Select card identities BEFORE loading relations. Pair only explicit links on
  // the same genuine date, and choose each source at most once. This keeps card
  // offsets stable, including when a review/viewing pair straddles a page edge.
  const selected = await txOrDb.execute(sql`
    WITH source AS (
      SELECT a.*, m.media_type, m.season_number, m.episode_number,
        CASE WHEN a.event_type = 'review' THEN
          CASE WHEN r.source_service = 'letterboxd' THEN r.source_review_date ELSE to_char(r.published_at, 'YYYY-MM-DD') END
        WHEN a.event_type = 'viewing' THEN d.watched_date
        WHEN a.event_type = 'watchlist' THEN
          CASE WHEN w.source_service IS NOT NULL THEN w.source_added_date ELSE to_char(w.created_at, 'YYYY-MM-DD') END
        ELSE a.event_date END AS true_date,
        d.review_id AS linked_review_id, r.viewing_id AS linked_viewing_id,
        CASE WHEN a.event_type = 'viewing' THEN d.rating_value WHEN a.event_type = 'review' THEN r.rating_value ELSE a.rating_value END AS true_rating,
        CASE WHEN a.event_type = 'viewing' THEN d.source_rating WHEN a.event_type = 'review' THEN r.source_rating ELSE a.source_rating END AS true_source_rating,
        d.is_rewatch AS true_rewatch
      FROM activity_events a
      JOIN media_items m ON m.id = a.media_item_id
      LEFT JOIN diary_entries d ON d.id = a.diary_entry_id AND d.user_id = a.user_id
      LEFT JOIN reviews r ON r.id = a.review_id AND r.user_id = a.user_id
      LEFT JOIN watchlist_items w ON w.id = a.watchlist_item_id AND w.user_id = a.user_id
      WHERE a.user_id = ${userId}
        AND (a.event_type <> 'review' OR r.status = 'published')
        AND (a.event_type <> 'viewing' OR d.id IS NOT NULL)
        AND (a.event_type <> 'watchlist' OR w.id IS NOT NULL)
    ), review_pairs AS (
      SELECT DISTINCT ON (r.id) v.id AS viewing, r.id AS review
      FROM source v JOIN source r ON v.event_type = 'viewing' AND r.event_type = 'review'
        AND v.media_item_id = r.media_item_id AND v.true_date = r.true_date
        AND (v.linked_review_id = r.review_id OR r.linked_viewing_id = v.diary_entry_id)
      ORDER BY r.id, v.id
    ), pairs AS (
      SELECT DISTINCT ON (viewing) viewing, review FROM review_pairs ORDER BY viewing, review
    ), cards AS (
      SELECT s.id, p.review AS partner, s.true_date, s.created_at,
        s.diary_entry_id, s.media_item_id
      FROM source s LEFT JOIN pairs p ON p.viewing = s.id
      LEFT JOIN source pr ON pr.id = p.review
      WHERE NOT EXISTS (SELECT 1 FROM pairs x WHERE x.review = s.id)
        AND (${filter} = 'all'
          OR (${filter} = 'films' AND s.media_type = 'movie')
          OR (${filter} = 'tv' AND (s.media_type IN ('tv', 'episode') OR s.season_number IS NOT NULL))
          OR (${filter} = 'viewings' AND s.event_type IN ('viewing', 'watched_mark'))
          OR (${filter} = 'reviews' AND (s.event_type = 'review' OR p.review IS NOT NULL))
          OR (${filter} = 'watchlist' AND s.event_type = 'watchlist')
          OR (${filter} = 'ratings' AND (s.event_type = 'rating' OR s.true_rating IS NOT NULL OR s.true_source_rating IS NOT NULL OR pr.true_rating IS NOT NULL OR pr.true_source_rating IS NOT NULL))
          OR (${filter} = 'rewatches' AND s.event_type = 'viewing' AND (s.true_rewatch OR EXISTS (
            SELECT 1 FROM diary_entries earlier JOIN diary_entries current ON current.id = s.diary_entry_id
            WHERE earlier.user_id = ${userId} AND earlier.media_item_id = s.media_item_id
            AND (coalesce(earlier.watched_date, '9999'), earlier.created_at, earlier.id) < (coalesce(current.watched_date, '9999'), current.created_at, current.id)
          )))
        )
    ), dated AS (
      SELECT *, count(*) OVER ()::int AS total FROM cards WHERE true_date IS NOT NULL
      ORDER BY true_date DESC, created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}
    )
    SELECT id, partner, true_date AS "eventDate", total, false AS undated FROM dated
    UNION ALL
    SELECT id, partner, true_date, (SELECT count(*)::int FROM cards WHERE true_date IS NOT NULL), true FROM cards WHERE true_date IS NULL
    UNION ALL
    SELECT NULL, NULL, NULL, (SELECT count(*)::int FROM cards WHERE true_date IS NOT NULL), false
  `);
  type SelectedCard = { id: string | null; partner: string | null; eventDate: string | null; total: number; undated: boolean };
  const rows = selected.rows as SelectedCard[];
  const ids = rows.flatMap((r) => r.id ? [r.id, ...(r.partner ? [r.partner] : [])] : []);
  const totalCount = rows[0]?.total ?? 0;
  if (!ids.length) return { entries: [], undatedEntries: [], totalCount, hasMore: offset < totalCount };
  const userActivities = await txOrDb.query.activityEvents.findMany({
    where: and(eq(activityEvents.userId, userId), inArray(activityEvents.id, ids)),
    with: { mediaItem: true, diaryEntry: true, review: true },
  });
  const ordinalsMap = new Map<string, number>();
  const mediaTotalsMap = new Map<string, number>();
  const mediaIds = [...new Set(userActivities.map((a: { mediaItemId: string }) => a.mediaItemId))];
  const userOrdinals = await txOrDb.execute(sql`
    SELECT id, media_item_id AS "mediaItemId",
      row_number() OVER (PARTITION BY media_item_id ORDER BY watched_date ASC NULLS LAST, created_at, id)::int AS ordinal,
      count(*) OVER (PARTITION BY media_item_id)::int AS "totalViewings"
    FROM diary_entries WHERE user_id = ${userId} AND media_item_id IN (${sql.join(mediaIds.map((id) => sql`${id}`), sql`, `)})
  `);
  for (const row of userOrdinals.rows as Array<{ id: string; mediaItemId: string; ordinal: number; totalViewings: number }>) {
    ordinalsMap.set(row.id, row.ordinal);
    mediaTotalsMap.set(row.mediaItemId, row.totalViewings);
  }
  const datesById = new Map(rows.flatMap((r) => r.id ? [[r.id, r.eventDate] as const, ...(r.partner ? [[r.partner, r.eventDate] as const] : [])] : []));
  const normalized = userActivities.map((a) => {
    const source = a.eventType === "viewing" ? a.diaryEntry : a.eventType === "review" ? a.review : undefined;
    const eventDate = datesById.get(a.id) ?? null;
    return { ...a, eventDate, ...(source ? { ratingValue: source.ratingValue, sourceRating: source.sourceRating, sourceScale: source.sourceScale } : {}),
      ...(a.eventType === "viewing" && a.diaryEntry ? { isRewatch: a.diaryEntry.isRewatch, reviewId: a.diaryEntry.reviewId, notes: a.diaryEntry.notes } : {}),
      ...(a.eventType === "review" && a.review ? { diaryEntryId: a.review.viewingId } : {}),
    };
  });
  const { datedItems, undatedItems } = combineChronologicalActivities(normalized, ordinalsMap, mediaTotalsMap);
  return { entries: datedItems, undatedEntries: undatedItems, totalCount, hasMore: offset + rows.filter((r) => r.id && !r.undated).length < totalCount };
}
