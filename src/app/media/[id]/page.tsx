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
import { WriteReviewButton } from "@/components/reviews/write-review-button";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";

export default async function MediaDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string }>;
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

  const lookupId = media ? media.id : decodedId;
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
              tierId: true,
            },
            with: {
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
      score: r.rating ? (r.rating.calculatedOverallScore ?? r.rating.sourceRating ?? null) : null,
      scale: 10,
      tier: r.rating?.tier
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

  const scores = publicReviews
    .map((r) => r.score)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));

  const averageScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

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

        <div className="absolute top-6 left-4 sm:left-8 z-20">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Explore</span>
          </Link>
        </div>

        <div className="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 z-20 max-w-4xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
              {isTv ? "Television" : "Film"}
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
              <span>★ {averageScore} / 10 community mean</span>
              <span className="text-muted-foreground">({publicReviews.length} reviews)</span>
            </div>
          )}
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
                <WriteReviewButton
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
                  } : null}
                />
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
                            ★ {rev.score.toFixed(1)}
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
