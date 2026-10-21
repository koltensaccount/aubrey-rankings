import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { mediaItems, ratings, collections, collectionEntries, user, reviews, diaryEntries, watchlistItems } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { tmdb } from "@/lib/tmdb";
import { getServerSession } from "@/lib/server-session";
import { getBlockedUserIds } from "@/lib/safety";
import { canShowReviewRating, reviewScoreOnTen, tmdbAudienceRating } from "@/lib/review-rating";
import { getCommunityAverage } from "@/lib/community-rating";
import { getPersonalMediaUrl } from "@/lib/media-url";
import { MediaHeroBanner } from "@/components/media/media-hero-banner";
import { MediaPublicOverview, type PublicReviewItem, type TvSeasonTab, type TvEpisodeItem } from "@/components/media/media-public-overview";
import { MediaPersonalView, type PersonalRatingData, type PersonalReviewData, type PersonalDiaryData, type PersonalCollectionRankData } from "@/components/media/media-personal-view";

export default async function MediaDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string; season?: string; journal?: string; view?: string }>;
}) {
  const { id: rawMediaId } = await params;
  let decodedId = rawMediaId;
  try {
    decodedId = decodeURIComponent(rawMediaId);
  } catch {}

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedType = resolvedSearchParams.type?.toLowerCase();
  const activeView: "overview" | "personal" = resolvedSearchParams.view === "personal" ? "personal" : "overview";

  let media: any = await db.query.mediaItems.findFirst({
    where: (m, { eq, or }) => or(eq(m.id, rawMediaId), eq(m.id, decodedId)),
  });

  // Check if it's an episode ID (e.g., tv_1399_s1_e1 or tmdb-tv-1399-s1-e1 or tmdb-episode-1399-1-1)
  const episodeMatch =
    /^(?:tmdb[-_])?tv[-_](\d+)[-_]s(\d+)[-_]e(\d+)$/i.exec(decodedId) ||
    /^(?:tmdb[-_])?episode[-_](\d+)[-_](\d+)[-_](\d+)$/i.exec(decodedId);

  if (!media && episodeMatch) {
    const tvId = parseInt(episodeMatch[1], 10);
    const seasonNumber = parseInt(episodeMatch[2], 10);
    const episodeNumber = parseInt(episodeMatch[3], 10);
    const targetEpisodeId = `tv_${tvId}_s${seasonNumber}_e${episodeNumber}`;

    media = await db.query.mediaItems.findFirst({
      where: (m, { eq }) => eq(m.id, targetEpisodeId),
    });

    if (!media) {
      try {
        const seasonData = await tmdb.getTvSeason(tvId, seasonNumber);
        const ep = seasonData.episodes?.find((e) => e.episode_number === episodeNumber);
        if (ep) {
          let showTitle = "";
          try {
            const tv = await tmdb.getTvDetails(tvId);
            showTitle = tv?.name || "";
          } catch {}

          media = {
            id: targetEpisodeId,
            tmdbId: ep.id,
            mediaType: "episode",
            title: ep.name ? (showTitle ? `${showTitle}: ${ep.name}` : ep.name) : `Episode ${episodeNumber}`,
            overview: ep.overview || null,
            posterPath: ep.still_path || null,
            backdropPath: null,
            stillPath: ep.still_path || null,
            releaseDate: ep.air_date || null,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            parentMediaId: `tv_${tvId}`,
            tmdbMetadata: { voteAverage: ep.vote_average },
          };
        }
      } catch {}
    }
  }

  const lookupId = media ? media.id : decodedId;
  const tvShowPrefixMatch = !media ? /^(?:tmdb[-_])?tv[-_]?(\d+)$/i.exec(lookupId) : null;
  const moviePrefixMatch = !media ? /^(?:tmdb[-_])?movie[-_]?(\d+)$/i.exec(lookupId) : null;

  if (!media && tvShowPrefixMatch) {
    const tmdbNum = parseInt(tvShowPrefixMatch[1], 10);
    media = await db.query.mediaItems.findFirst({
      where: (m, { eq, and }) => and(eq(m.tmdbId, tmdbNum), eq(m.mediaType, "tv")),
    });
    if (!media) {
      try {
        const tv = await tmdb.getTvDetails(tmdbNum);
        if (tv && (tv.name || tv.id)) {
          media = {
            id: `tmdb-tv-${tv.id}`,
            tmdbId: tv.id,
            mediaType: "tv",
            title: tv.name || "Untitled Series",
            overview: tv.overview || null,
            posterPath: tv.poster_path || null,
            backdropPath: tv.backdrop_path || null,
            stillPath: null,
            releaseDate: tv.first_air_date || null,
            seasonNumber: null,
            episodeNumber: null,
            parentMediaId: null,
            tmdbMetadata: { voteAverage: tv.vote_average, voteCount: tv.vote_count },
          };
        }
      } catch {}
    }
  }

  if (!media && moviePrefixMatch) {
    const tmdbNum = parseInt(moviePrefixMatch[1], 10);
    media = await db.query.mediaItems.findFirst({
      where: (m, { eq, and }) => and(eq(m.tmdbId, tmdbNum), eq(m.mediaType, "movie")),
    });
    if (!media) {
      try {
        const movie = await tmdb.getMovieDetails(tmdbNum);
        if (movie && (movie.title || movie.id)) {
          media = {
            id: `tmdb-movie-${movie.id}`,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title || "Untitled Film",
            overview: movie.overview || null,
            posterPath: movie.poster_path || null,
            backdropPath: movie.backdrop_path || null,
            stillPath: null,
            releaseDate: movie.release_date || null,
            seasonNumber: null,
            episodeNumber: null,
            parentMediaId: null,
            tmdbMetadata: { voteAverage: movie.vote_average, voteCount: movie.vote_count },
          };
        }
      } catch {}
    }
  }

  if (!media && /^\d+$/.test(lookupId)) {
    const tmdbNum = parseInt(lookupId, 10);
    if (requestedType === "movie" || requestedType === "tv") {
      media = await db.query.mediaItems.findFirst({
        where: (m, { eq, and }) =>
          and(eq(m.tmdbId, tmdbNum), eq(m.mediaType, requestedType)),
      });
    } else {
      media = await db.query.mediaItems.findFirst({
        where: (m, { eq }) => eq(m.tmdbId, tmdbNum),
      });
    }

    // Resolve from TMDB on demand without inserting into the database
    if (!media) {
      try {
        if (requestedType === "tv") {
          const tv = await tmdb.getTvDetails(tmdbNum);
          if (tv && (tv.name || tv.id)) {
            media = {
              id: `tmdb-tv-${tv.id}`,
              tmdbId: tv.id,
              mediaType: "tv",
              title: tv.name || "Untitled Series",
              overview: tv.overview || null,
              posterPath: tv.poster_path || null,
              backdropPath: tv.backdrop_path || null,
              stillPath: null,
              releaseDate: tv.first_air_date || null,
              seasonNumber: null,
              episodeNumber: null,
              parentMediaId: null,
              tmdbMetadata: { voteAverage: tv.vote_average, voteCount: tv.vote_count },
            };
          }
        } else if (requestedType === "movie") {
          const movie = await tmdb.getMovieDetails(tmdbNum);
          if (movie && (movie.title || movie.id)) {
            media = {
              id: `tmdb-movie-${movie.id}`,
              tmdbId: movie.id,
              mediaType: "movie",
              title: movie.title || "Untitled Film",
              overview: movie.overview || null,
              posterPath: movie.poster_path || null,
              backdropPath: movie.backdrop_path || null,
              stillPath: null,
              releaseDate: movie.release_date || null,
              seasonNumber: null,
              episodeNumber: null,
              parentMediaId: null,
              tmdbMetadata: { voteAverage: movie.vote_average, voteCount: movie.vote_count },
            };
          }
        } else {
          try {
            const movie = await tmdb.getMovieDetails(tmdbNum);
            if (movie && (movie.title || movie.id)) {
              media = {
                id: `tmdb-movie-${movie.id}`,
                tmdbId: movie.id,
                mediaType: "movie",
                title: movie.title || "Untitled Film",
                overview: movie.overview || null,
                posterPath: movie.poster_path || null,
                backdropPath: movie.backdrop_path || null,
                stillPath: null,
                releaseDate: movie.release_date || null,
                seasonNumber: null,
                episodeNumber: null,
                parentMediaId: null,
                tmdbMetadata: { voteAverage: movie.vote_average, voteCount: movie.vote_count },
              };
            }
          } catch {
            const tv = await tmdb.getTvDetails(tmdbNum);
            if (tv && (tv.name || tv.id)) {
              media = {
                id: `tmdb-tv-${tv.id}`,
                tmdbId: tv.id,
                mediaType: "tv",
                title: tv.name || "Untitled Series",
                overview: tv.overview || null,
                posterPath: tv.poster_path || null,
                backdropPath: tv.backdrop_path || null,
                stillPath: null,
                releaseDate: tv.first_air_date || null,
                seasonNumber: null,
                episodeNumber: null,
                parentMediaId: null,
                tmdbMetadata: { voteAverage: tv.vote_average, voteCount: tv.vote_count },
              };
            }
          }
        }
      } catch {
        // TMDB request failed
      }
    }
  }

  if (!media) {
    notFound();
  }

  const session = await getServerSession();

  // If requesting personal view while not signed in, redirect to login
  if (activeView === "personal" && !session) {
    redirect(`/login?redirect=${encodeURIComponent(getPersonalMediaUrl(media.id))}`);
  }

  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  const isEphemeral = typeof media.id === "string" && media.id.startsWith("tmdb-");
  const syntheticMatch = isEphemeral ? /^tmdb-(movie|tv)-(\d+)$/.exec(media.id) : null;
  const restoredMedia = syntheticMatch ? await db.query.mediaItems.findFirst({
    where: (m, { and, eq }) => and(eq(m.tmdbId, Number(syntheticMatch[2])), eq(m.mediaType, syntheticMatch[1])),
  }) : null;
  const journalMediaId = restoredMedia?.id ?? media.id;

  // Query Personal Data for authenticated user
  const ownerGlobalRating = session
    ? await db.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) => and(eq(r.userId, session.user.id), eq(r.mediaItemId, journalMediaId), isNull(r.collectionId)),
        with: {
          categoryScores: {
            with: {
              category: true,
            },
          },
          ratingSystem: true,
          tier: true,
        },
      })
    : null;

  const ownerReviews = session
    ? await db.query.reviews.findMany({
        where: (rv, { and, eq }) => and(
          eq(rv.userId, session.user.id),
          eq(rv.mediaItemId, journalMediaId)
        ),
        orderBy: [desc(reviews.updatedAt)],
      })
    : [];

  const ownerJournalReview = ownerReviews.find((r) => r.isJournal) || null;

  const ownerDiaryEntries = session
    ? await db.query.diaryEntries.findMany({
        where: (d, { and, eq }) => and(
          eq(d.userId, session.user.id),
          eq(d.mediaItemId, journalMediaId)
        ),
        orderBy: [desc(diaryEntries.watchedDate), desc(diaryEntries.loggedDate), desc(diaryEntries.createdAt)],
      })
    : [];

  const ownerWatchlistItem = session
    ? await db.query.watchlistItems.findFirst({
        where: (w, { and, eq }) => and(
          eq(w.userId, session.user.id),
          eq(w.mediaItemId, journalMediaId)
        ),
      })
    : null;

  const allMediaCollectionEntries = session
    ? await db.query.collectionEntries.findMany({
        where: eq(collectionEntries.mediaItemId, journalMediaId),
        with: {
          collection: true,
        },
      })
    : [];

  const ownerRankedCollections: PersonalCollectionRankData[] = allMediaCollectionEntries
    .filter((e) => e.collection && e.collection.userId === session?.user?.id)
    .map((e) => ({
      collectionId: e.collection.id,
      collectionTitle: e.collection.title,
      collectionType: e.collection.collectionType || "standard",
      sortOrder: e.sortOrder,
      notes: e.notes,
    }));

  const normalizedRatingScore = ownerGlobalRating
    ? reviewScoreOnTen({
        calculatedOverallScore: ownerGlobalRating.calculatedOverallScore,
        sourceRating: ownerGlobalRating.sourceRating,
        sourceScale: ownerGlobalRating.sourceScale,
        sourceService: ownerGlobalRating.sourceService,
        ratingSystemId: ownerGlobalRating.ratingSystemId,
        tierId: ownerGlobalRating.tierId,
        ratingSystem: ownerGlobalRating.ratingSystem ? { scale: ownerGlobalRating.ratingSystem.scale, type: ownerGlobalRating.ratingSystem.type } : null,
        categoryScores: ownerGlobalRating.categoryScores ?? [],
      })
    : null;

  const hasPersonalRating = Boolean(
    ownerGlobalRating && (
      normalizedRatingScore !== null ||
      ownerGlobalRating.calculatedOverallScore !== null ||
      ownerGlobalRating.sourceRating !== null ||
      ownerGlobalRating.tierId !== null
    )
  );

  const hasPersonalActivity = Boolean(
    hasPersonalRating ||
    ownerReviews.length > 0 ||
    ownerDiaryEntries.length > 0 ||
    ownerWatchlistItem ||
    ownerRankedCollections.length > 0
  );

  const personalSummary = session
    ? {
        isWatched: Boolean(ownerGlobalRating?.isWatched || ownerDiaryEntries.length > 0),
        viewingsCount: ownerDiaryEntries.length,
        hasReview: ownerReviews.length > 0,
        hasRating: hasPersonalRating,
        isWatchlist: Boolean(ownerWatchlistItem),
        rankedCollectionsCount: ownerRankedCollections.length,
      }
    : null;

  // Query Public Data: published public reviews and scores
  const rawFirstClassReviews = await db.query.reviews.findMany({
    where: (rv, { and, eq }) =>
      and(
        eq(rv.mediaItemId, journalMediaId),
        eq(rv.status, "published"),
        eq(rv.visibility, "public")
      ),
    orderBy: [desc(reviews.publishedAt), desc(reviews.createdAt)],
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      rating: {
        columns: {
          id: true,
          calculatedOverallScore: true,
          sourceRating: true,
          sourceScale: true,
          sourceService: true,
          ratingSystemId: true,
          tierId: true,
        },
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: { columns: { id: true } },
          tier: {
            columns: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  const publicReviews: PublicReviewItem[] = rawFirstClassReviews
    .filter((r) => !blockedUserIds.has(r.userId))
    .map((r) => ({
      id: r.id,
      reviewType: "independent" as const,
      reviewUrl: `/review/${r.id}`,
      title: r.title,
      reviewText: r.content,
      contentFormat: r.contentFormat,
      score: r.rating && canShowReviewRating(r) ? reviewScoreOnTen(r.rating) : null,
      scale: 10,
      tier: canShowReviewRating(r) && r.rating?.tier
        ? {
            id: r.rating.tier.id,
            name: r.rating.tier.name,
            color: r.rating.tier.color,
          }
        : null,
      isSpoiler: r.isSpoiler,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
    }));

  const averageScore = await getCommunityAverage(journalMediaId, blockedUserIds);
  let tmdbRating = tmdbAudienceRating(media.tmdbMetadata);
  let tvSeasonsList: TvSeasonTab[] = [];
  let seasonEpisodes: TvEpisodeItem[] = [];
  const selectedSeason = resolvedSearchParams.season ? parseInt(resolvedSearchParams.season, 10) : 1;
  let activeSeasonNumber = selectedSeason;

  if (media.tmdbId && media.mediaType === "tv") {
    try {
      const details = await tmdb.getTvDetails(media.tmdbId);
      tmdbRating = tmdbAudienceRating(details) ?? tmdbRating;
      if (details?.seasons?.length) {
        tvSeasonsList = details.seasons.filter((s: any) => s.season_number > 0);
        if (!tvSeasonsList.length) tvSeasonsList = details.seasons;
        const currentSeason = tvSeasonsList.find((s: any) => s.season_number === selectedSeason) || tvSeasonsList[0];
        if (currentSeason) {
          activeSeasonNumber = currentSeason.season_number;
          const seasonData = await tmdb.getTvSeason(media.tmdbId, currentSeason.season_number);
          seasonEpisodes = (seasonData?.episodes || []).map((e: any) => ({
            id: e.id,
            name: e.name,
            overview: e.overview || null,
            episode_number: e.episode_number,
            season_number: e.season_number,
            air_date: e.air_date || null,
            still_path: e.still_path || null,
          }));
        }
      }
    } catch { /* Keep available cached metadata when TMDB is unavailable. */ }

    // Fall back to stored episode records in database if TMDB is unavailable
    if (tvSeasonsList.length === 0) {
      try {
        const storedEpisodes = await db.query.mediaItems.findMany({
          where: (m, { eq, and }) => and(eq(m.parentMediaId, media.id), eq(m.mediaType, "episode")),
          orderBy: (m, { asc }) => [asc(m.seasonNumber), asc(m.episodeNumber)],
        });
        if (storedEpisodes.length > 0) {
          const seasonNums = Array.from(new Set(storedEpisodes.map((e) => e.seasonNumber || 1))).sort((a, b) => a - b);
          tvSeasonsList = seasonNums.map((num) => ({
            season_number: num,
            name: `Season ${num}`,
          }));
          activeSeasonNumber = selectedSeason;
          seasonEpisodes = storedEpisodes
            .filter((e) => (e.seasonNumber || 1) === activeSeasonNumber)
            .map((e) => ({
              id: e.tmdbId || e.id,
              name: e.title,
              overview: e.overview,
              episode_number: e.episodeNumber || 1,
              season_number: e.seasonNumber || activeSeasonNumber,
              air_date: e.releaseDate,
              still_path: e.stillPath,
            }));
        }
      } catch {}
    }
  } else if (media.tmdbId && media.mediaType === "movie") {
    try {
      const details = await tmdb.getMovieDetails(media.tmdbId);
      tmdbRating = tmdbAudienceRating(details) ?? tmdbRating;
    } catch { /* Keep available cached metadata when TMDB is unavailable. */ }
  }

  const parentTvIdMatch = media.parentMediaId
    ? /^(?:tmdb-)?tv_?(\d+)$/i.exec(media.parentMediaId) || /^\d+$/.exec(media.parentMediaId)
    : null;
  const parentTvNumericId = parentTvIdMatch ? parentTvIdMatch[1] ?? parentTvIdMatch[0] : null;
  const seriesDetailsHref = parentTvNumericId
    ? `/media/${parentTvNumericId}?type=tv`
    : media.parentMediaId
      ? `/media/${media.parentMediaId}?type=tv`
      : null;

  const shouldAutoOpen = Boolean(session && (resolvedSearchParams.journal === "1" || resolvedSearchParams.journal === "true"));

  const personalRatingProp: PersonalRatingData | null = ownerGlobalRating
    ? {
        id: ownerGlobalRating.id,
        calculatedOverallScore: ownerGlobalRating.calculatedOverallScore,
        normalizedScore: normalizedRatingScore ?? ownerGlobalRating.calculatedOverallScore,
        sourceRating: ownerGlobalRating.sourceRating,
        sourceScale: ownerGlobalRating.sourceScale,
        sourceService: ownerGlobalRating.sourceService,
        ratingSystemId: ownerGlobalRating.ratingSystemId,
        ratingSystemName: ownerGlobalRating.ratingSystem?.name || null,
        tier: ownerGlobalRating.tier
          ? {
              id: ownerGlobalRating.tier.id,
              name: ownerGlobalRating.tier.name,
              color: ownerGlobalRating.tier.color,
            }
          : null,
        categoryScores: ownerGlobalRating.categoryScores?.map((cs) => ({
          categoryId: cs.categoryId,
          categoryName: (cs as any).category?.name || "Criterion",
          score: cs.score,
        })),
        personalNotes: ownerGlobalRating.personalNotes,
      }
    : null;

  const personalReviewsProp: PersonalReviewData[] = ownerReviews.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    draftContent: r.draftContent,
    contentFormat: r.contentFormat,
    draftContentFormat: r.draftContentFormat,
    status: r.status,
    visibility: r.visibility,
    isSpoiler: r.isSpoiler,
    isJournal: Boolean(r.isJournal),
    shareRating: Boolean(r.shareRating),
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));

  const personalJournalReviewProp: PersonalReviewData | null = ownerJournalReview
    ? {
        id: ownerJournalReview.id,
        title: ownerJournalReview.title,
        content: ownerJournalReview.content,
        draftContent: ownerJournalReview.draftContent,
        contentFormat: ownerJournalReview.contentFormat,
        draftContentFormat: ownerJournalReview.draftContentFormat,
        status: ownerJournalReview.status,
        visibility: ownerJournalReview.visibility,
        isSpoiler: ownerJournalReview.isSpoiler,
        isJournal: Boolean(ownerJournalReview.isJournal),
        shareRating: Boolean(ownerJournalReview.shareRating),
        publishedAt: ownerJournalReview.publishedAt,
        updatedAt: ownerJournalReview.updatedAt,
        createdAt: ownerJournalReview.createdAt,
      }
    : null;

  const personalDiaryProp: PersonalDiaryData[] = ownerDiaryEntries.map((d) => ({
    id: d.id,
    watchedDate: d.watchedDate,
    loggedDate: d.loggedDate,
    isRewatch: d.isRewatch,
    ratingValue: d.ratingValue,
    notes: d.notes,
    createdAt: d.createdAt,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 transition-colors">
      <MediaHeroBanner
        media={media}
        activeView={activeView}
        isAuthenticated={Boolean(session)}
        hasPersonalActivity={hasPersonalActivity}
        averageScore={averageScore}
        tmdbRating={tmdbRating}
        seriesDetailsHref={seriesDetailsHref}
        personalSummary={personalSummary}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeView === "personal" ? (
          <MediaPersonalView
            media={media}
            journalMediaId={journalMediaId}
            isWatchlist={Boolean(ownerWatchlistItem)}
            ownerRating={personalRatingProp}
            ownerJournalReview={personalJournalReviewProp}
            ownerReviews={personalReviewsProp}
            ownerDiaryEntries={personalDiaryProp}
            ownerRankedCollections={ownerRankedCollections}
            shouldAutoOpen={shouldAutoOpen}
          />
        ) : (
          <MediaPublicOverview
            media={media}
            journalMediaId={journalMediaId}
            isAuthenticated={Boolean(session)}
            isWatchlist={Boolean(ownerWatchlistItem)}
            hasPersonalActivity={hasPersonalActivity}
            ownerGlobalRating={ownerGlobalRating ? {
              calculatedOverallScore: ownerGlobalRating.calculatedOverallScore,
              ratingSystemId: ownerGlobalRating.ratingSystemId,
              categoryScores: ownerGlobalRating.categoryScores?.map((cs) => ({
                categoryId: cs.categoryId,
                score: cs.score,
              })),
            } : null}
            ownerJournalReview={ownerJournalReview ? {
              id: ownerJournalReview.id,
              title: ownerJournalReview.title,
              content: ownerJournalReview.content,
              draftContent: ownerJournalReview.draftContent,
              contentFormat: ownerJournalReview.contentFormat,
              draftContentFormat: ownerJournalReview.draftContentFormat,
              status: ownerJournalReview.status,
              visibility: ownerJournalReview.visibility,
              isSpoiler: ownerJournalReview.isSpoiler,
              ratingId: ownerJournalReview.ratingId,
              shareRating: ownerJournalReview.shareRating,
            } : null}
            shouldAutoOpen={shouldAutoOpen}
            averageScore={averageScore}
            tmdbRating={tmdbRating}
            tvSeasonsList={tvSeasonsList}
            seasonEpisodes={seasonEpisodes}
            activeSeasonNumber={activeSeasonNumber}
            publicReviews={publicReviews}
          />
        )}
      </main>
    </div>
  );
}
