import Link from "next/link";
import { Star, Tv, BookOpen, UserCheck, Film, ExternalLink, Calendar, MessageSquare, Sparkles, Heart } from "lucide-react";
import { WriteReviewButton } from "@/components/reviews/write-review-button";
import { AddToRankingButton } from "@/components/collections/add-to-ranking-dialog";
import { MediaWatchlistButton } from "./media-watchlist-button";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { LikeButton } from "@/components/social/like-button";
import { getPublicMediaUrl, getPersonalMediaUrl } from "@/lib/media-url";
import type { CommunityAverageResult } from "@/lib/review-rating";

export interface PublicReviewItem {
  id: string;
  reviewType: "independent";
  reviewUrl: string;
  title: string | null;
  reviewText: string;
  contentFormat: string | null;
  score: number | null;
  scale: number;
  tier: {
    id: string;
    name: string;
    color: string;
  } | null;
  isSpoiler: boolean;
  sourceService?: string | null;
  sourceReviewDate?: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

export interface PublicRankingItem {
  collectionId: string;
  collectionTitle: string;
  collectionType: string;
  isRanked: boolean;
  rankPosition: number;
  tierName?: string | null;
  tierColor?: string | null;
  itemCount: number;
  owner: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

export interface TvSeasonTab {
  id?: number | string;
  season_number: number;
  name: string;
}

export interface TvEpisodeItem {
  id: number | string;
  name: string;
  overview: string | null;
  episode_number: number;
  season_number?: number;
  air_date?: string | null;
  still_path?: string | null;
  stillUrl?: string | null;
}

interface MediaPublicOverviewProps {
  media: {
    id: string;
    title: string;
    mediaType?: string | null;
    overview?: string | null;
    releaseDate?: string | null;
    posterPath?: string | null;
    stillPath?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    parentMediaId?: string | null;
  };
  journalMediaId: string;
  isAuthenticated: boolean;
  isWatchlist: boolean;
  hasPersonalActivity: boolean;
  ownerGlobalRating: { calculatedOverallScore?: number | null; ratingSystemId?: string | null; categoryScores?: Array<{ categoryId: string; score: number }> } | null;
  ownerJournalReview: { id: string; title: string | null; content: string; draftContent: string | null; contentFormat: string; draftContentFormat: string | null; status: string; visibility: string; isSpoiler: boolean; ratingId: string | null; shareRating: boolean } | null;
  shouldAutoOpen: boolean;
  averageScore?: CommunityAverageResult | null;
  tmdbRating?: { score: number; votes: number | null } | null;
  tvSeasonsList?: TvSeasonTab[];
  seasonEpisodes?: TvEpisodeItem[];
  activeSeasonNumber?: number;
  publicReviews: PublicReviewItem[];
  publicRankings?: PublicRankingItem[];
  from?: string | null;
}

export function MediaPublicOverview({
  media,
  journalMediaId,
  isAuthenticated,
  isWatchlist,
  hasPersonalActivity,
  ownerGlobalRating,
  ownerJournalReview,
  shouldAutoOpen,
  averageScore,
  tmdbRating,
  tvSeasonsList = [],
  seasonEpisodes = [],
  activeSeasonNumber = 1,
  publicReviews,
  publicRankings = [],
  from,
}: MediaPublicOverviewProps) {
  const isTv = media.mediaType === "tv";
  const isEpisode = media.mediaType === "episode" || (media.seasonNumber !== null && media.episodeNumber !== null);
  const personalViewUrl = getPersonalMediaUrl(media.id, { from: from || undefined });

  return (
    <div className="space-y-10">
      {/* Contextual Action Bar */}
      <section
        aria-label="Media actions"
        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {isTv ? (
            <a
              href="#seasons-and-episodes"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors shadow-xs"
            >
              <Tv size={14} />
              <span>Browse Seasons & Log Episodes</span>
            </a>
          ) : (
            <WriteReviewButton
              isCanonical
              buttonId="canonical-journal-button"
              autoOpen={shouldAutoOpen}
              mediaItemId={journalMediaId}
              mediaTitle={media.title}
              posterPath={media.posterPath || media.stillPath}
              initialQuickScore={ownerGlobalRating?.calculatedOverallScore ?? null}
              initialDetailedRating={
                ownerGlobalRating?.ratingSystemId
                  ? {
                      ratingSystemId: ownerGlobalRating.ratingSystemId,
                      categoryScores: (ownerGlobalRating.categoryScores || []).map((score) => ({
                        categoryId: score.categoryId,
                        score: score.score,
                      })),
                    }
                  : null
              }
              existingReview={
                ownerJournalReview
                  ? {
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
                    }
                  : null
              }
            />
          )}

          <AddToRankingButton
            mediaItemId={journalMediaId}
            mediaTitle={media.title}
            mediaType={media.mediaType as any}
            seasonNumber={media.seasonNumber}
            episodeNumber={media.episodeNumber}
            parentShowTmdbId={
              media.mediaType === "episode" && media.parentMediaId
                ? parseInt(media.parentMediaId.replace(/^tv_/, ""), 10) || null
                : null
            }
            posterPath={media.posterPath}
            stillPath={media.stillPath}
          />

          <MediaWatchlistButton
            mediaItemId={journalMediaId}
            initialIsWatchlist={isWatchlist}
          />
        </div>

        {/* Quick link to personal view if logged in */}
        <div className="flex items-center gap-2 text-xs">
          {isAuthenticated ? (
            <Link
              href={personalViewUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated font-medium text-foreground transition-colors"
            >
              <UserCheck size={13} className="text-primary" />
              <span>
                {hasPersonalActivity ? "View your rating & activity" : "Open Your View"}
              </span>
              <span className="text-muted-foreground">&rarr;</span>
            </Link>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(personalViewUrl)}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserCheck size={13} />
              <span>Sign in to log in your Journal</span>
            </Link>
          )}
        </div>
      </section>

      {/* Synopsis Section */}
      {media.overview && (
        <section className="space-y-2">
          <h2 className="font-display text-lg uppercase font-bold text-foreground tracking-wide">
            Synopsis
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {media.overview}
          </p>
        </section>
      )}

      {/* Seasons & Episodes for TV Shows */}
      {isTv && tvSeasonsList.length > 0 && (
        <section id="seasons-and-episodes" className="space-y-4 pt-4 border-t border-border">
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
                  href={`/media/${encodeURIComponent(media.id)}?type=tv&season=${s.season_number}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    s.season_number === activeSeasonNumber
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface border border-border text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  {s.name || `Season ${s.season_number}`}
                </Link>
              ))}
            </div>
          )}

          {/* Episode Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {seasonEpisodes.map((ep) => {
              const epMediaId = `tv_${media.id.replace(/^(?:tmdb-tv-|tv_)/, "")}_s${activeSeasonNumber}_e${ep.episode_number}`;
              const epPublicUrl = getPublicMediaUrl(epMediaId);
              const still = ep.stillUrl || (ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null);

              return (
                <div
                  key={ep.id}
                  className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                >
                  {still ? (
                    <Link
                      href={epPublicUrl}
                      className="w-full sm:w-32 h-20 shrink-0 rounded-lg overflow-hidden bg-surface relative group block"
                    >
                      <img
                        src={still}
                        alt={ep.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/75 text-white">
                        E{ep.episode_number}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      href={epPublicUrl}
                      className="w-full sm:w-32 h-20 shrink-0 rounded-lg bg-surface flex items-center justify-center border border-border text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      E{ep.episode_number}
                    </Link>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground truncate hover:text-primary transition-colors">
                        <Link href={epPublicUrl}>
                          {ep.episode_number}. {ep.name}
                        </Link>
                      </h4>
                      {ep.overview && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                          {ep.overview}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <WriteReviewButton
                        mediaItemId={epMediaId}
                        mediaTitle={`${media.title}: S${activeSeasonNumber}E${ep.episode_number} "${ep.name}"`}
                        posterPath={ep.still_path}
                        className="text-[11px] px-2 py-1"
                      />
                      <Link
                        href={epPublicUrl}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                      >
                        Details &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Community Ratings & Score Distribution */}
      <section aria-label="Community ratings" className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary fill-primary" />
              <h2 className="font-display text-xl uppercase font-bold text-foreground tracking-tight">
                Community Rating
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on {averageScore ? averageScore.count : 0} public {averageScore?.count === 1 ? "review rating" : "review ratings"}
            </p>
          </div>

          {averageScore && averageScore.count > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {averageScore.average.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                / 10
              </span>
              <span className="text-xs text-primary font-medium ml-1">
                ({averageScore.starsAverage.toFixed(1)} ★)
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              No community ratings yet
            </span>
          )}
        </div>

        {/* Rating Distribution Histogram */}
        {averageScore && averageScore.count > 0 && averageScore.distribution?.buckets && (
          <div className="pt-3 border-t border-border space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rating Distribution
            </h3>
            <div className="space-y-1.5 max-w-md">
              {averageScore.distribution.buckets.map((bucket) => (
                <div key={bucket.stars} className="flex items-center gap-2.5 text-xs">
                  <span className="w-10 text-right font-mono font-medium text-muted-foreground shrink-0">
                    {bucket.stars} ★
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden border border-border/50">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-[11px] text-muted-foreground shrink-0">
                    {bucket.count} ({bucket.percentage.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Published Community Reviews */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary-text" />
            <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Community Reviews
            </h2>
            <span className="text-xs font-mono text-muted-foreground ml-1">
              ({publicReviews.length})
            </span>
          </div>
          {publicReviews.length > 0 && averageScore && averageScore.count > 0 && (
            <div className="text-xs text-muted-foreground">
              ★ {averageScore.average.toFixed(1)} / 10 Aubrey average
            </div>
          )}
        </div>

        {publicReviews.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3 bg-card/40">
            <MessageSquare size={28} className="mx-auto text-muted-foreground opacity-50" />
            <div className="space-y-1">
              <p className="font-medium text-sm text-foreground">
                No community reviews published yet.
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Be the first to share your thoughts, analysis, or critique with the Aubrey community.
              </p>
            </div>
            {!isTv && (
              <div className="pt-2">
                <WriteReviewButton
                  mediaItemId={journalMediaId}
                  mediaTitle={media.title}
                  posterPath={media.posterPath || media.stillPath}
                  className="px-4 py-2"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {publicReviews.map((rev) => {
              const authorInitial = (rev.author.name || rev.author.username || "U")[0].toUpperCase();
              const profileHref = rev.author.username ? `/profile/${rev.author.username}` : null;
              const formattedDate = rev.publishedAt
                ? new Date(rev.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : rev.sourceReviewDate || null;

              return (
                <article
                  key={rev.id}
                  className="p-4 sm:p-5 rounded-xl border border-border bg-card space-y-3 hover:border-border transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between gap-3">
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
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {formattedDate && (
                            <span>{formattedDate}</span>
                          )}
                          {formattedDate && <span>·</span>}
                          <Link
                            href={rev.reviewUrl}
                            className="text-primary-text hover:underline"
                          >
                            View Dispatch &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {rev.tier && (
                        <div
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-xs"
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

                  {/* Review Title & Body */}
                  <div className="pl-10 border-l border-border space-y-1.5">
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
                      className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line italic"
                    />
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <div className="flex items-center gap-4">
                        <LikeButton reviewId={rev.id} />
                        <Link
                          href={`${rev.reviewUrl}#comments`}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageSquare size={13} />
                          <span>Discussion</span>
                        </Link>
                      </div>

                      <Link
                        href={rev.reviewUrl}
                        className="text-xs font-semibold text-primary-text hover:underline inline-flex items-center gap-1"
                      >
                        <span>Read full review &rarr;</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Rankings Featuring This Title */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary-text" />
            <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Rankings Featuring This Title
            </h2>
            <span className="text-xs font-mono text-muted-foreground ml-1">
              ({publicRankings.length})
            </span>
          </div>
        </div>

        {publicRankings.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-2 bg-card/40">
            <p className="text-xs text-muted-foreground">
              This title hasn&apos;t been added to any public rankings yet.
            </p>
            <div className="pt-1">
              <AddToRankingButton
                mediaItemId={journalMediaId}
                mediaTitle={media.title}
                mediaType={media.mediaType as any}
                posterPath={media.posterPath}
                stillPath={media.stillPath}
                className="px-3 py-1.5 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {publicRankings.map((ranking) => {
              const ownerInitial = (ranking.owner.name || ranking.owner.username || "U")[0].toUpperCase();
              const profileHref = ranking.owner.username ? `/profile/${ranking.owner.username}` : null;

              return (
                <div
                  key={ranking.collectionId}
                  className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/collection/${ranking.collectionId}`}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {ranking.collectionTitle}
                      </Link>
                      {ranking.tierName ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shrink-0"
                          style={{ backgroundColor: ranking.tierColor || "var(--color-primary)" }}
                        >
                          {ranking.tierName}
                        </span>
                      ) : ranking.isRanked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 shrink-0">
                          #{ranking.rankPosition}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="capitalize">{ranking.collectionType.replace("_", " ")}</span>
                      <span>·</span>
                      <span>{ranking.itemCount} {ranking.itemCount === 1 ? "title" : "titles"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-2">
                      {profileHref ? (
                        <Link href={profileHref} className="flex items-center gap-1.5 group">
                          <div className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-primary shrink-0 overflow-hidden">
                            {ranking.owner.image ? (
                              <img src={ranking.owner.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              ownerInitial
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                            {ranking.owner.name || `@${ranking.owner.username}`}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {ownerInitial}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {ranking.owner.name || "Ranker"}
                          </span>
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/collection/${ranking.collectionId}`}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>View List</span>
                      <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
