import Link from "next/link";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import {
  collections,
  ratings,
  savedRankings,
  reviews,
  diaryEntries,
  watchlistItems,
  mediaItems,
  activityEvents,
} from "@/db/schema";
import { desc, eq, and, isNull, inArray, count, isNotNull, sql } from "drizzle-orm";
import { getRatingSummary } from "@/lib/scoring";
import { reviewScoreOnTen } from "@/lib/review-rating";
import { LibraryView, type LibraryTab } from "@/components/library/library-view";
import type { TimelineEntry } from "@/components/library/cinematic-timeline";
import type { WatchedItem } from "@/components/library/watched-grid";
import type { WatchlistGridItem } from "@/components/library/watchlist-grid";
import { getUserUnifiedTimeline } from "@/lib/timeline-activity";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; filter?: string }>;
}) {
  const session = await getServerSession();

  // =========================================================================
  // LOGGED OUT LANDING VIEW (Cinematic Editorial Presentation)
  // =========================================================================
  if (!session) {
    return (
      <div className="ar-homeContent">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-8 sm:p-12 lg:p-16 shadow-lg">
            {/* Background 4K Still */}
            <div className="absolute inset-0 z-0">
              <img
                src="/placeholders/backdrop-placeholder.svg"
                alt="Cinema backdrop"
                className="w-full h-full object-cover object-center opacity-40 filter saturate-75"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            </div>

            <div className="relative z-10 max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
                <span>Cinema & TV Journal · Critique · Weighted Rankings</span>
              </div>

              {/* Aubrey Rankings Brand Mark */}
              <div className="py-1">
                <span className="font-display text-3xl sm:text-4xl uppercase tracking-widest text-primary font-bold drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                  AUBREY RANKINGS
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight text-foreground leading-[0.92] uppercase">
                Log. Critique.
                <br />
                <span className="text-primary">Rank What You Watch.</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Track and rate everything you watch in a personal cinema journal. Write critical reviews and selectively publish them to the community. Build weighted ranking rubrics for anthology television, director sagas, and custom collections.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-sm transition-all shadow-md"
                >
                  Get started
                </Link>
                <Link
                  href="/discover"
                  className="px-6 py-3.5 rounded-xl bg-secondary hover:bg-muted text-secondary-foreground border border-border font-semibold text-sm transition-all"
                >
                  Explore &amp; Journal
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-xl text-muted-foreground hover:text-foreground font-semibold text-sm transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Balanced Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-12">
            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Private Watch History</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Personal Journal</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log films and episodes as you watch. Score with quick or weighted rubrics, and keep personal notes and drafts visible only to you.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Critical Writing</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Reviews &amp; Feed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Publish longform critiques to the Community Feed, share unlisted direct links with friends, or keep entries strictly private.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Anthology Television</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Episode-by-Episode</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Import complete series like Black Mirror or Severance. Score each episode with 16:9 cinematic stills and weighted categories.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <span className="text-xs text-primary font-semibold uppercase tracking-wider block">Franchises &amp; Sagas</span>
              <h3 className="font-display text-2xl uppercase text-foreground">Canons &amp; Auteurs</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rank complete director sagas from David Fincher, Christopher Nolan, or Denis Villeneuve with official key art and averages.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // LOGGED IN USER: UNIFIED MY LIBRARY (PHASE 14B)
  // =========================================================================
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedTab = (resolvedSearchParams.tab?.toLowerCase() as LibraryTab) || "journal";

  // 1. Fetch User Activity Events (Paginated initial batch with total count)
  const timelineResult = await getUserUnifiedTimeline(session.user.id, {
    limit: 100,
    filter: (resolvedSearchParams.filter as any) || "all",
  });
  const userDiaryEntries = timelineResult.entries as unknown as TimelineEntry[];
  const totalDiaryCount = timelineResult.totalCount;
  const undatedItems = timelineResult.undatedEntries;

  // 2. Fetch User Reviews & Standalone Ratings
  const userReviews = await db.query.reviews.findMany({
    where: eq(reviews.userId, session.user.id),
    orderBy: [desc(reviews.updatedAt)],
    with: {
      mediaItem: true,
      rating: {
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: true,
        },
      },
    },
  });

  // Fetch standalone ratings and watched-only records
  const linkedRatingIds = new Set(userReviews.map((r) => r.ratingId).filter(Boolean));
  const userRatings = await db.query.ratings.findMany({
    where: and(eq(ratings.userId, session.user.id), isNull(ratings.collectionId)),
    orderBy: [desc(ratings.updatedAt)],
    with: {
      mediaItem: true,
      ratingSystem: { columns: { scale: true, type: true } },
      categoryScores: true,
    },
  });

  const standaloneRatings = userRatings.filter((r) => !linkedRatingIds.has(r.id));
  const ratedStandalone = standaloneRatings.filter((r) => reviewScoreOnTen(r) !== null);
  const watchedOnlyStandalone = standaloneRatings.filter(
    (r) => reviewScoreOnTen(r) === null && r.isWatched
  );

  // Filter out reviews that already have an associated diary entry across all lifetime records
  const linkedDiaryReviewRows = await db
    .select({ reviewId: diaryEntries.reviewId })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, session.user.id), isNotNull(diaryEntries.reviewId)));
  const diaryReviewIds = new Set(linkedDiaryReviewRows.map((r) => r.reviewId).filter(Boolean));

  const undatedReviews = userReviews
    .filter((r) => !diaryReviewIds.has(r.id) && !r.watchedDate)
    .map((r) => ({
      id: r.id,
      mediaItem: r.mediaItem,
      ratingValue: r.rating ? reviewScoreOnTen(r.rating) : null,
      status: r.status,
      content: r.draftContent || r.content,
    }));

  // 3. Fetch Watched Titles (All Lifetime History)
  // Query all media items ever logged in diary entries by this user with exact viewing counts
  const diaryWatchedRows = await db
    .select({
      mediaItemId: diaryEntries.mediaItemId,
      viewingCount: count(),
      lastWatchedDate: sql<string | null>`max(${diaryEntries.watchedDate})`,
      id: mediaItems.id,
      title: mediaItems.title,
      releaseDate: mediaItems.releaseDate,
      mediaType: mediaItems.mediaType,
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      posterPath: mediaItems.posterPath,
      stillPath: mediaItems.stillPath,
    })
    .from(diaryEntries)
    .innerJoin(mediaItems, eq(diaryEntries.mediaItemId, mediaItems.id))
    .where(eq(diaryEntries.userId, session.user.id))
    .groupBy(
      diaryEntries.mediaItemId,
      mediaItems.id,
      mediaItems.title,
      mediaItems.releaseDate,
      mediaItems.mediaType,
      mediaItems.seasonNumber,
      mediaItems.episodeNumber,
      mediaItems.posterPath,
      mediaItems.stillPath,
    );

  const watchedMap = new Map<string, WatchedItem>();

  diaryWatchedRows.forEach((row) => {
    const year = row.releaseDate ? parseInt(row.releaseDate.slice(0, 4), 10) : null;
    watchedMap.set(row.id, {
      id: row.id,
      title: row.title,
      year,
      mediaType: row.mediaType,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      posterPath: row.posterPath,
      stillPath: row.stillPath,
      viewingCount: row.viewingCount,
      userRating: null,
      lastWatchedDate: row.lastWatchedDate,
    });
  });

  // Add ratings where isWatched is true or attach scores
  userRatings.forEach((rating) => {
    if (!rating.mediaItem) return;
    const m = rating.mediaItem;
    const year = m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) : null;
    const normalizedScore = reviewScoreOnTen(rating);

    if (!watchedMap.has(m.id) && rating.isWatched) {
      watchedMap.set(m.id, {
        id: m.id,
        title: m.title,
        year,
        mediaType: m.mediaType,
        seasonNumber: m.seasonNumber,
        episodeNumber: m.episodeNumber,
        posterPath: m.posterPath,
        stillPath: m.stillPath,
        viewingCount: 1,
        userRating: normalizedScore,
        lastWatchedDate: rating.watchDate ? rating.watchDate.toISOString().slice(0, 10) : null,
      });
    } else if (watchedMap.has(m.id)) {
      const item = watchedMap.get(m.id)!;
      if (item.userRating === null || item.userRating === undefined) {
        item.userRating = normalizedScore;
      }
      if (rating.watchDate) {
        const ratingDateStr = rating.watchDate.toISOString().slice(0, 10);
        if (!item.lastWatchedDate || ratingDateStr > item.lastWatchedDate) {
          item.lastWatchedDate = ratingDateStr;
        }
      }
    }
  });

  // Also check if any loaded diary entry has a rating to attach if userRating is still null
  userDiaryEntries.forEach((entry: any) => {
    if (watchedMap.has(entry.mediaItemId)) {
      const item = watchedMap.get(entry.mediaItemId)!;
      if (item.userRating === null || item.userRating === undefined) {
        if (typeof entry.ratingValue === "number") {
          item.userRating = entry.ratingValue;
        } else if (entry.rating) {
          item.userRating = reviewScoreOnTen(entry.rating as any);
        }
      }
    }
  });

  const watchedItems = Array.from(watchedMap.values());

  // 4. Fetch Watchlist Items
  const rawWatchlist = await db.query.watchlistItems.findMany({
    where: eq(watchlistItems.userId, session.user.id),
    orderBy: [desc(watchlistItems.createdAt)],
    with: {
      mediaItem: true,
    },
  });

  const userWatchlist = rawWatchlist as WatchlistGridItem[];

  // 5. Fetch User Collections (Rankings and Custom Lists)
  const userCollections = await db.query.collections.findMany({
    where: eq(collections.userId, session.user.id),
    orderBy: [desc(collections.isPinned), desc(collections.updatedAt)],
    with: {
      entries: {
        with: {
          mediaItem: true,
        },
      },
      ratings: { with: { ratingSystem: { columns: { scale: true } } } },
    },
  });

  // 6. User's saved rankings (bookmarks from community)
  const userSavedRankings = await db.query.savedRankings.findMany({
    where: eq(savedRankings.userId, session.user.id),
    orderBy: [desc(savedRankings.createdAt)],
    with: {
      collection: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          entries: {
            limit: 4,
            with: { mediaItem: true },
          },
          ratings: { with: { ratingSystem: { columns: { scale: true } } } },
        },
      },
    },
  });

  const accessibleSavedCollections = userSavedRankings
    .filter((sr) => {
      if (!sr.collection) return false;
      const isOwner = sr.collection.userId === session.user.id;
      const isPublic =
        sr.collection.visibility !== "private" &&
        (sr.collection.visibility === "public" ||
          sr.collection.visibility === "unlisted" ||
          sr.collection.isPublic);
      return isOwner || isPublic;
    })
    .map((sr) => sr.collection);

  // Compute summary stats
  const allUserRatings = await db.query.ratings.findMany({
    where: eq(ratings.userId, session.user.id),
    columns: { calculatedOverallScore: true, sourceRating: true, sourceScale: true },
    with: { ratingSystem: { columns: { scale: true } } },
  });
  const { meanScore, ratedCount: totalRatedCount } = getRatingSummary(allUserRatings);

  return (
    <div className="ar-homeContent ar-communityHome">
      <LibraryView
        initialTab={requestedTab}
        initialFilter={resolvedSearchParams.filter}
        diaryEntries={userDiaryEntries}
        totalDiaryCount={totalDiaryCount}
        userReviews={userReviews}
        standaloneRatings={ratedStandalone}
        watchedOnlyRecords={watchedOnlyStandalone}
        undatedEntries={undatedItems.length > 0 ? (undatedItems as any) : undatedReviews}
        watchedItems={watchedItems}
        watchlistItems={userWatchlist}
        collections={userCollections}
        savedCollections={accessibleSavedCollections}
        totalRatedCount={totalRatedCount}
        meanScore={meanScore}
      />
    </div>
  );
}
