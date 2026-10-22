import { db } from "@/db";
import {
  activityEvents,
  diaryEntries,
  reviews,
  ratings,
  watchlistItems,
  mediaItems,
} from "@/db/schema";
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { reviewScoreOnTen } from "@/lib/review-rating";

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
  txOrDb: any = db
): Promise<void> {
  // 1. Backfill from diary entries
  const userDiaries = await txOrDb.query.diaryEntries.findMany({
    where: eq(diaryEntries.userId, userId),
  });

  for (const d of userDiaries) {
    const key = d.sourceEventKey || `diary:${d.id}`;
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

  // 2. Backfill from published reviews
  const userReviews = await txOrDb.query.reviews.findMany({
    where: and(eq(reviews.userId, userId), eq(reviews.status, "published")),
  });

  for (const r of userReviews) {
    const key = `rev:${r.id}`;
    // Genuine review/activity date: strictly published date, never substituted with viewing/watched date or import timestamp
    const pubDate = r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : null;
    const eventDate = pubDate;

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

  // 3. Backfill from watchlist items
  const userWl = await txOrDb.query.watchlistItems.findMany({
    where: eq(watchlistItems.userId, userId),
  });

  for (const w of userWl) {
    const key = `wl:${w.id}`;
    const dateAdded = w.createdAt ? w.createdAt.toISOString().slice(0, 10) : null;

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
      // (e.g. matching viewingId/diaryEntryId or matching Letterboxd source URI)
      const key = `${mediaId}::${date}`;
      const candidates = reviewByMediaAndDate.get(key) || [];
      const unconsumed = candidates.find((r) => {
        if (consumedReviewIds.has(r.reviewId || r.id)) return false;
        const isExplicitlyLinked =
          r.diaryEntryId === (act.diaryEntryId || act.id) ||
          act.reviewId === (r.reviewId || r.id);
        const isSameSourceSession =
          Boolean(act.sourceUri && r.sourceUri && act.sourceUri === r.sourceUri);
        return isExplicitlyLinked || isSameSourceSession;
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
        reviewContent: matchingReview.review?.content || matchingReview.notes || matchingReview.reviewContent,
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
        reviewContent: act.review?.content || act.notes || act.reviewContent,
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
    return bTime - aTime;
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
  txOrDb: any = db
): Promise<{
  entries: UnifiedTimelineCardData[];
  totalCount: number;
  hasMore: boolean;
  undatedEntries: UnifiedTimelineCardData[];
}> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const filter = options.filter || "all";

  // Ensure activity events are up-to-date
  await backfillUserActivityEvents(userId, txOrDb);

  // 1. Fetch user activity events with relations
  const userActivities = await txOrDb.query.activityEvents.findMany({
    where: eq(activityEvents.userId, userId),
    orderBy: [desc(activityEvents.eventDate), desc(activityEvents.createdAt), desc(activityEvents.id)],
    with: {
      mediaItem: true,
      diaryEntry: {
        with: {
          rating: {
            with: {
              ratingSystem: { columns: { scale: true, type: true } },
              categoryScores: true,
            },
          },
          review: true,
        },
      },
      review: true,
      rating: {
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: true,
        },
      },
      watchlistItem: true,
    },
  });

  // 2. Compute ordinals and total viewings per media item
  const ordinalsMap = new Map<string, number>();
  const mediaTotalsMap = new Map<string, number>();

  const userOrdinals = await txOrDb.execute(sql`
    SELECT 
      id,
      media_item_id as "mediaItemId",
      ROW_NUMBER() OVER (
        PARTITION BY media_item_id 
        ORDER BY 
          CASE WHEN watched_date IS NOT NULL AND watched_date != '' THEN 0 ELSE 1 END ASC,
          watched_date ASC,
          created_at ASC,
          id ASC
      )::int as ordinal,
      COUNT(*) OVER (
        PARTITION BY media_item_id
      )::int as "totalViewings"
    FROM diary_entries
    WHERE user_id = ${userId}
  `);

  for (const row of userOrdinals.rows as Array<{
    id: string;
    mediaItemId: string;
    ordinal: number;
    totalViewings: number;
  }>) {
    ordinalsMap.set(row.id, row.ordinal);
    mediaTotalsMap.set(row.mediaItemId, row.totalViewings);
  }

  // 3. Normalize and combine
  const { datedItems, undatedItems } = combineChronologicalActivities(
    userActivities,
    ordinalsMap,
    mediaTotalsMap
  );

  // 4. Apply filter if specified
  const applyFilter = (items: UnifiedTimelineCardData[]) => {
    if (filter === "all") return items;
    return items.filter((e) => {
      const isEpisode =
        e.mediaItem?.mediaType === "episode" ||
        Boolean(e.mediaItem?.seasonNumber && e.mediaItem?.episodeNumber);

      if (filter === "films") {
        return e.mediaItem?.mediaType === "movie" || (!isEpisode && e.mediaItem?.mediaType !== "tv");
      }
      if (filter === "tv") {
        return isEpisode || e.mediaItem?.mediaType === "tv";
      }
      if (filter === "rewatches") {
        const ordinal = e.ordinal ?? ordinalsMap.get(e.diaryEntryId || e.id) ?? 1;
        return Boolean(e.isRewatch || ordinal > 1);
      }
      if (filter === "viewings") {
        return (
          e.eventType === "viewing" ||
          e.eventType === "viewing_and_review" ||
          e.eventType === "watched_mark"
        );
      }
      if (filter === "reviews") {
        return (
          e.eventType === "review" ||
          e.eventType === "viewing_and_review" ||
          Boolean(e.reviewContent || e.reviewId)
        );
      }
      if (filter === "ratings") {
        return (
          e.eventType === "rating" ||
          typeof e.ratingValue === "number" ||
          typeof e.sourceRating === "number"
        );
      }
      if (filter === "watchlist") {
        return e.eventType === "watchlist";
      }
      return true;
    });
  };

  const filteredDated = applyFilter(datedItems);
  const filteredUndated = applyFilter(undatedItems);

  const pagedEntries = filteredDated.slice(offset, offset + limit);
  const totalCount = filteredDated.length;
  const hasMore = offset + pagedEntries.length < totalCount;

  return {
    entries: pagedEntries,
    totalCount,
    hasMore,
    undatedEntries: filteredUndated,
  };
}
