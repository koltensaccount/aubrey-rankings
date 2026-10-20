import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { mediaItems, ratings, collections, user, reviews } from "@/db/schema";
import { eq, and, isNull, isNotNull, ne, desc } from "drizzle-orm";
import { getTmdbImageUrl, tmdb } from "@/lib/tmdb";
import { resolvePosterUrl } from "@/lib/artwork";
import { getServerSession } from "@/lib/server-session";
import { getBlockedUserIds } from "@/lib/safety";
import { ArrowLeft, Star, Film, Tv, MessageSquare, ExternalLink, EyeOff } from "lucide-react";
import { WriteReviewButton, JournalTriggerButton } from "@/components/reviews/write-review-button";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { canShowReviewRating, reviewScoreOnTen, tmdbAudienceRating } from "@/lib/review-rating";
import { getCommunityAverage } from "@/lib/community-rating";

export default async function MediaDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string; season?: string; journal?: string }>;
}) {
  const { id: rawMediaId } = await params;
  let decodedId = rawMediaId;
  try {
    decodedId = decodeURIComponent(rawMediaId);
  } catch {}

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedType = resolvedSearchParams.type?.toLowerCase();

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

    // If still not in DB, resolve from TMDB on demand WITHOUT inserting into the database
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
          // No media type specified: try movie first, then TV
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
  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  // Fetch published public first-class reviews and legacy collection reviews
  const isEphemeral = typeof media.id === "string" && media.id.startsWith("tmdb-");
  const syntheticMatch = isEphemeral ? /^tmdb-(movie|tv)-(\d+)$/.exec(media.id) : null;
  const restoredMedia = syntheticMatch ? await db.query.mediaItems.findFirst({
    where: (m, { and, eq }) => and(eq(m.tmdbId, Number(syntheticMatch[2])), eq(m.mediaType, syntheticMatch[1])),
  }) : null;
  const journalMediaId = restoredMedia?.id ?? media.id;
  const ownerGlobalRating = session
    ? await db.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) => and(eq(r.userId, session.user.id), eq(r.mediaItemId, journalMediaId), isNull(r.collectionId)),
        with: { categoryScores: true },
      })
    : null;
  const ownerJournalReview = session
    ? await db.query.reviews.findFirst({
        where: (rv, { and, eq, or }) => and(
          eq(rv.userId, session.user.id),
          eq(rv.mediaItemId, journalMediaId),
          eq(rv.isJournal, true),
          ownerGlobalRating ? or(eq(rv.ratingId, ownerGlobalRating.id), isNull(rv.ratingId)) : isNull(rv.ratingId)
        ),
        orderBy: [desc(reviews.updatedAt)],
      })
    : null;

  // 1. First-class published reviews
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

  const firstClassReviews = rawFirstClassReviews
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
      watchDate: null,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
      collection: null,
    }));

  const publicReviews = firstClassReviews;

  const averageScore = await getCommunityAverage(journalMediaId, blockedUserIds);
  let tmdbRating = tmdbAudienceRating(media.tmdbMetadata);
  let tvSeasonsList: any[] = [];
  let seasonEpisodes: any[] = [];
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
          seasonEpisodes = seasonData?.episodes || [];
        }
      }
    } catch { /* Keep available cached metadata when TMDB is unavailable. */ }
  } else if (media.tmdbId && media.mediaType === "movie") {
    try {
      const details = await tmdb.getMovieDetails(media.tmdbId);
      tmdbRating = tmdbAudienceRating(details) ?? tmdbRating;
    } catch { /* Keep available cached metadata when TMDB is unavailable. */ }
  }

  const isTv = media.mediaType === "tv" || media.mediaType === "episode" || Boolean(media.seasonNumber);
  const stillUrl = media.stillPath ? getTmdbImageUrl(media.stillPath, "original") : null;
  const backdropUrl = media.backdropPath ? getTmdbImageUrl(media.backdropPath, "original") : null;
  const posterUrl = media.posterPath ? resolvePosterUrl(media.posterPath, "w500") : null;
  const heroImage = stillUrl || backdropUrl || posterUrl;

  const year = (media.releaseDate || "").split("-")[0];
  const episodeBadge =
    media.seasonNumber && media.episodeNumber
      ? `Season ${media.seasonNumber}, Episode ${media.episodeNumber}`
      : media.seasonNumber
        ? `Season ${media.seasonNumber}`
        : null;

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

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 transition-colors">
      {/* Hero Banner */}
      <div className="relative w-full h-72 sm:h-96 overflow-hidden bg-card border-b border-border">
        {heroImage ? (
          <>
            <img
              src={heroImage}
              alt={media.title}
              className="w-full h-full object-cover opacity-40 filter saturate-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-surface" />
        )}

        <div className="absolute top-6 left-4 sm:left-8 z-20 flex items-center gap-2">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Explore</span>
          </Link>
          {seriesDetailsHref && (
            <Link
              href={seriesDetailsHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors"
            >
              <Tv size={13} />
              <span>Series Details</span>
            </Link>
          )}
        </div>

        <div className="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 z-20 max-w-4xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
              {media.mediaType === "episode" ? "Television Episode" : isTv ? "Television" : "Film"}
            </span>
            {episodeBadge && (
              <span className="text-xs font-semibold text-muted-foreground">
                · {episodeBadge}
              </span>
            )}
            {year && (
              <span className="text-xs text-muted-foreground">
                · {year}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-5xl uppercase font-bold text-foreground tracking-tight">
            {media.title}
          </h1>

          {averageScore && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-semibold">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span>★ {averageScore.average.toFixed(1)} / 10 Aubrey average ({averageScore.count} people)</span>
              <span className="text-muted-foreground">({publicReviews.length} reviews)</span>
            </div>
          )}
          {tmdbRating && <p className="text-xs text-foreground">TMDB audience: {tmdbRating.score.toFixed(1)} / 10{tmdbRating.votes !== null ? ` · ${tmdbRating.votes.toLocaleString()} votes` : ""}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* Overview */}
        {media.overview && (
          <section className="space-y-2">
            <h2 className="font-display text-lg uppercase font-bold text-foreground">
              Synopsis
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {media.overview}
            </p>
          </section>
        )}

        {/* Seasons & Episodes section for TV shows */}
        {media.mediaType === "tv" && tvSeasonsList.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Tv size={18} className="text-primary-text" />
                <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
                  Seasons & Episodes
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Season {activeSeasonNumber} ({seasonEpisodes.length} episodes)
              </span>
            </div>

            {/* Season Selector Tabs */}
            {tvSeasonsList.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {tvSeasonsList.map((s) => (
                  <Link
                    key={s.id || s.season_number}
                    href={`/media/${encodeURIComponent(rawMediaId)}?type=tv&season=${s.season_number}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      s.season_number === activeSeasonNumber
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface border border-border text-foreground hover:bg-surface-raised"
                    }`}
                  >
                    {s.name || `Season ${s.season_number}`}
                  </Link>
                ))}
              </div>
            )}

            {/* Episodes List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {seasonEpisodes.map((ep) => {
                const epMediaId = `tv_${media.tmdbId}_s${activeSeasonNumber}_e${ep.episode_number}`;
                const still = ep.still_path ? getTmdbImageUrl(ep.still_path, "w300") : null;
                return (
                  <div
                    key={ep.id}
                    className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                  >
                    {still ? (
                      <div className="w-full sm:w-32 h-20 shrink-0 rounded-lg overflow-hidden bg-surface relative">
                        <img
                          src={still}
                          alt={ep.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-white">
                          E{ep.episode_number}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full sm:w-32 h-20 shrink-0 rounded-lg bg-surface flex items-center justify-center text-xs font-mono text-muted-foreground border border-border">
                        S{activeSeasonNumber}E{ep.episode_number}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                          <span>Episode {ep.episode_number}</span>
                          {ep.air_date && <span>· {ep.air_date.split("-")[0]}</span>}
                        </div>
                        <h4 className="font-semibold text-sm text-foreground truncate mt-0.5">
                          {ep.name || `Episode ${ep.episode_number}`}
                        </h4>
                        {ep.overview && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {ep.overview}
                          </p>
                        )}
                      </div>
                      <div className="pt-2 flex items-center gap-2">
                        <Link
                          href={`/media/${epMediaId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline"
                        >
                          <span>Journal Episode &rarr;</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Community Reviews Section */}
        <section className="space-y-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare size={18} className="text-primary-text" />
              <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
                Community Reviews ({publicReviews.length})
              </h2>
            </div>

            <WriteReviewButton
              autoOpen={shouldAutoOpen}
              mediaItemId={journalMediaId}
              mediaTitle={media.title}
              posterPath={media.posterPath}
              initialQuickScore={ownerGlobalRating?.calculatedOverallScore ?? null}
              initialDetailedRating={ownerGlobalRating?.ratingSystemId ? { ratingSystemId: ownerGlobalRating.ratingSystemId, categoryScores: ownerGlobalRating.categoryScores.map((score) => ({ categoryId: score.categoryId, score: score.score })) } : null}
              existingReview={ownerJournalReview ? {
                id: ownerJournalReview.id,
                title: ownerJournalReview.title,
                content: ownerJournalReview.content,
                draftContent: ownerJournalReview.draftContent,
                contentFormat: ownerJournalReview.contentFormat as "plain" | "markdown",
                draftContentFormat: ownerJournalReview.draftContentFormat as "plain" | "markdown" | null,
                status: ownerJournalReview.status as "draft" | "published" | "unpublished",
                visibility: ownerJournalReview.visibility as "private" | "unlisted" | "public",
                isSpoiler: ownerJournalReview.isSpoiler,
                ratingId: ownerJournalReview.ratingId,
                shareRating: ownerJournalReview.shareRating,
                isJournal: true,
              } : null}
            />
          </div>

          {publicReviews.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-border bg-card/60 p-6 space-y-3">
              <p className="text-sm font-semibold text-foreground">No published reviews yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Be the first to write a critical dispatch or rank &ldquo;{media.title}&rdquo;.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                <JournalTriggerButton hasEntry={Boolean(ownerJournalReview || ownerGlobalRating)} />
                <Link
                  href={`/create?suggest=${encodeURIComponent(media.title)}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-raised text-foreground font-semibold text-xs transition-colors"
                >
                  Start a Ranking with this Title
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {publicReviews.map((rev) => {
                const authorInitial = (
                  rev.author.name ||
                  rev.author.username ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase();

                const profileHref = rev.author.username
                  ? `/u/${rev.author.username}`
                  : null;

                return (
                  <article
                    key={rev.id}
                    className="rounded-card border border-border-card bg-card p-5 space-y-3 transition-colors shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {profileHref ? (
                          <Link
                            href={profileHref}
                            className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                          >
                            {rev.author.image ? (
                              <img
                                src={rev.author.image}
                                alt={rev.author.name || "Critic"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              authorInitial
                            )}
                          </Link>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text shrink-0">
                            {authorInitial}
                          </div>
                        )}

                        <div className="text-xs">
                          <div className="flex items-center gap-1.5">
                            {profileHref ? (
                              <Link
                                href={profileHref}
                                className="font-semibold text-foreground hover:text-primary-text transition-colors"
                              >
                                {rev.author.name || `@${rev.author.username}`}
                              </Link>
                            ) : (
                              <span className="font-semibold text-foreground">
                                {rev.author.name || "Critic"}
                              </span>
                            )}
                            {rev.author.username && (
                              <span className="text-muted-foreground">@{rev.author.username}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Published Review ·{" "}
                            <Link
                              href={rev.reviewUrl}
                              className="text-primary-text hover:underline"
                            >
                              View Dispatch &rarr;
                            </Link>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {rev.tier && (
                          <div
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-sm"
                            style={{ backgroundColor: rev.tier.color }}
                          >
                            Tier {rev.tier.name}
                          </div>
                        )}
                        {rev.score !== null && (
                          <div className="px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-bold text-primary-text">
                            ★ {rev.score.toFixed(1)} / 10
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Review Title & Text */}
                    <div className="pl-10 border-l border-border/60 space-y-1.5">
                      {rev.title && (
                        <h4 className="font-display text-sm uppercase font-bold text-foreground">
                          <Link href={rev.reviewUrl} className="hover:text-primary-text transition-colors">
                            {rev.title}
                          </Link>
                        </h4>
                      )}
                      <SpoilerConcealedText
                        content={rev.reviewText}
                        format={rev.contentFormat as "plain" | "markdown"}
                        isSpoiler={rev.isSpoiler}
                        quoteStyle={true}
                        className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line italic"
                      />
                      {rev.reviewType === "independent" && (
                        <div className="pt-1">
                          <Link
                            href={rev.reviewUrl}
                            className="text-xs font-semibold text-primary-text hover:underline inline-flex items-center gap-1"
                          >
                            <span>Read full review & join discussion →</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
