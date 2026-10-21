import Link from "next/link";
import {
  Star,
  Tv,
  Eye,
  Calendar,
  BookOpen,
  Sparkles,
  ExternalLink,
  Lock,
  Globe,
  PenLine,
  ListOrdered,
  Plus,
  Clock,
  ArrowRight,
  EyeOff,
} from "lucide-react";
import { WriteReviewButton } from "@/components/reviews/write-review-button";
import { AddToRankingButton } from "@/components/collections/add-to-ranking-dialog";
import { MediaWatchlistButton } from "./media-watchlist-button";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { getPublicMediaUrl } from "@/lib/media-url";

export interface PersonalRatingData {
  id: string;
  calculatedOverallScore?: number | null;
  ratingSystemId?: string | null;
  ratingSystemName?: string | null;
  tier?: {
    id: string;
    name: string;
    color: string;
  } | null;
  categoryScores?: Array<{
    categoryId: string;
    categoryName?: string;
    score: number;
    weight?: number;
  }>;
  personalNotes?: string | null;
}

export interface PersonalReviewData {
  id: string;
  title: string | null;
  content: string;
  draftContent: string | null;
  contentFormat: string;
  draftContentFormat: string | null;
  status: "draft" | "published" | "unpublished" | string;
  visibility: "public" | "unlisted" | "private" | string;
  isSpoiler: boolean;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
}

export interface PersonalDiaryData {
  id: string;
  watchedDate: string | null;
  loggedDate: Date | string | null;
  isRewatch: boolean;
  ratingValue: number | null;
  notes: string | null;
  createdAt: Date | string;
}

export interface PersonalCollectionRankData {
  collectionId: string;
  collectionTitle: string;
  collectionType: string;
  sortOrder: number;
  notes: string | null;
  score?: number | null;
  tier?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface MediaPersonalViewProps {
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
  isWatchlist: boolean;
  ownerRating: PersonalRatingData | null;
  ownerReviews: PersonalReviewData[];
  ownerDiaryEntries: PersonalDiaryData[];
  ownerRankedCollections: PersonalCollectionRankData[];
  shouldAutoOpen: boolean;
}

export function MediaPersonalView({
  media,
  journalMediaId,
  isWatchlist,
  ownerRating,
  ownerReviews,
  ownerDiaryEntries,
  ownerRankedCollections,
  shouldAutoOpen,
}: MediaPersonalViewProps) {
  const isTv = media.mediaType === "tv";
  const publicOverviewUrl = getPublicMediaUrl(media.id);

  // Pick the most recent draft or review for editing context
  const primaryReview = ownerReviews[0] || null;

  return (
    <div className="space-y-10">
      {/* View Switcher Banner */}
      <section className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-semibold text-primary-text">
            Viewing your personal history & ratings
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            — private notes & drafts are visible only to you.
          </span>
        </div>
        <Link
          href={publicOverviewUrl}
          className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline transition-colors ml-auto sm:ml-0"
        >
          <span>Open Public Overview</span>
          <ArrowRight size={13} />
        </Link>
      </section>

      {/* Contextual Action Bar */}
      <section
        aria-label="Personal media actions"
        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {isTv ? (
            <Link
              href={`${publicOverviewUrl}#seasons-and-episodes`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors shadow-xs"
            >
              <Tv size={14} />
              <span>Browse Seasons & Log Episodes</span>
            </Link>
          ) : (
            <WriteReviewButton
              autoOpen={shouldAutoOpen}
              mediaItemId={journalMediaId}
              mediaTitle={media.title}
              posterPath={media.posterPath || media.stillPath}
              initialQuickScore={ownerRating?.calculatedOverallScore ?? null}
              initialDetailedRating={
                ownerRating?.ratingSystemId
                  ? {
                      ratingSystemId: ownerRating.ratingSystemId,
                      categoryScores: (ownerRating.categoryScores || []).map((score) => ({
                        categoryId: score.categoryId,
                        score: score.score,
                      })),
                    }
                  : null
              }
              existingReview={
                primaryReview
                  ? {
                      id: primaryReview.id,
                      title: primaryReview.title,
                      content: primaryReview.content,
                      draftContent: primaryReview.draftContent,
                      contentFormat: primaryReview.contentFormat as "plain" | "markdown",
                      draftContentFormat: primaryReview.draftContentFormat as "plain" | "markdown" | null,
                      status: primaryReview.status as "draft" | "published" | "unpublished",
                      visibility: primaryReview.visibility as "private" | "unlisted" | "public",
                      isSpoiler: primaryReview.isSpoiler,
                      ratingId: ownerRating?.id || null,
                      shareRating: false,
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

        <div className="text-xs text-muted-foreground flex items-center gap-3">
          {ownerDiaryEntries.length > 0 && (
            <span className="font-medium text-foreground">
              {ownerDiaryEntries.length} {ownerDiaryEntries.length === 1 ? "viewing logged" : "viewings logged"}
            </span>
          )}
          {ownerRankedCollections.length > 0 && (
            <span className="font-medium text-foreground">
              In {ownerRankedCollections.length} {ownerRankedCollections.length === 1 ? "ranking" : "rankings"}
            </span>
          )}
        </div>
      </section>

      {/* Grid: Rating Information & Viewing History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Your Standalone Rating */}
        <div className="p-5 rounded-xl border border-border bg-card space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-primary-text" />
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Your Rating
              </h3>
            </div>
            {ownerRating && (
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Standalone
              </span>
            )}
          </div>

          {ownerRating?.calculatedOverallScore !== undefined && ownerRating.calculatedOverallScore !== null ? (
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-display font-extrabold text-primary-text">
                  ★ {ownerRating.calculatedOverallScore.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground font-semibold">
                  / 10
                </span>
                {ownerRating.tier && (
                  <span
                    className="ml-auto px-2 py-0.5 rounded text-xs font-mono font-bold text-white shadow-xs"
                    style={{ backgroundColor: ownerRating.tier.color }}
                  >
                    Tier {ownerRating.tier.name}
                  </span>
                )}
              </div>

              {ownerRating.ratingSystemName && (
                <p className="text-xs text-muted-foreground">
                  Using system: <strong className="text-foreground">{ownerRating.ratingSystemName}</strong>
                </p>
              )}

              {/* Multi-criteria category scores if present */}
              {ownerRating.categoryScores && ownerRating.categoryScores.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Criteria Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ownerRating.categoryScores.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border"
                      >
                        <span className="text-muted-foreground truncate mr-2">
                          {cat.categoryName || "Category"}
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {cat.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ownerRating.personalNotes && (
                <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider">
                    Rating Notes
                  </span>
                  <p className="italic bg-surface p-2.5 rounded-lg border border-border text-foreground">
                    {ownerRating.personalNotes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-3 bg-surface/40">
              <p className="text-xs text-muted-foreground">
                You haven&apos;t assigned a standalone rating to this title yet.
              </p>
              {!isTv && (
                <WriteReviewButton
                  mediaItemId={journalMediaId}
                  mediaTitle={media.title}
                  posterPath={media.posterPath || media.stillPath}
                  className="px-3 py-1.5"
                />
              )}
            </div>
          )}
        </div>

        {/* Card 2: Viewing History Timeline */}
        <div className="p-5 rounded-xl border border-border bg-card space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-primary-text" />
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Viewing History
              </h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {ownerDiaryEntries.length} {ownerDiaryEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {ownerDiaryEntries.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-3 bg-surface/40">
              <Clock size={24} className="mx-auto text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">
                No viewing history logged in your Journal yet.
              </p>
              {!isTv && (
                <WriteReviewButton
                  mediaItemId={journalMediaId}
                  mediaTitle={media.title}
                  posterPath={media.posterPath || media.stillPath}
                  className="px-3 py-1.5"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {ownerDiaryEntries.map((entry, idx) => {
                const dateDisplay = entry.watchedDate || (entry.loggedDate ? new Date(entry.loggedDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Logged viewing");
                return (
                  <div
                    key={entry.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {dateDisplay}
                        </span>
                        {entry.isRewatch && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25">
                            Rewatch
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {entry.ratingValue !== null && (
                      <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border font-bold text-primary-text font-mono">
                        ★ {entry.ratingValue.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Personal Reviews & Drafts */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary-text" />
            <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Your Reviews & Drafts
            </h3>
            <span className="text-xs font-mono text-muted-foreground ml-1">
              ({ownerReviews.length})
            </span>
          </div>
          {!isTv && (
            <WriteReviewButton
              mediaItemId={journalMediaId}
              mediaTitle={media.title}
              posterPath={media.posterPath || media.stillPath}
              initialQuickScore={ownerRating?.calculatedOverallScore ?? null}
              className="text-xs px-3 py-1.5"
            />
          )}
        </div>

        {ownerReviews.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3 bg-card/40">
            <BookOpen size={28} className="mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium text-sm text-foreground">
              You haven&apos;t written a review for this title yet.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Drafts and private notes are visible only to you. You can publish whenever you&apos;re ready.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ownerReviews.map((rev) => {
              const displayContent = rev.draftContent || rev.content;
              const format = (rev.draftContentFormat || rev.contentFormat || "plain") as "plain" | "markdown";
              return (
                <article
                  key={rev.id}
                  className="p-4 sm:p-5 rounded-xl border border-border bg-card space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      {rev.status === "draft" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                          Draft
                        </span>
                      ) : rev.status === "published" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface text-foreground border border-border">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface text-muted-foreground border border-border">
                          {rev.status}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {rev.visibility === "private" ? (
                          <>
                            <EyeOff size={12} />
                            <span>Private</span>
                          </>
                        ) : rev.visibility === "unlisted" ? (
                          <>
                            <Lock size={12} />
                            <span>Unlisted</span>
                          </>
                        ) : (
                          <>
                            <Globe size={12} />
                            <span>Public</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <WriteReviewButton
                        mediaItemId={journalMediaId}
                        mediaTitle={media.title}
                        posterPath={media.posterPath || media.stillPath}
                        existingReview={{
                          id: rev.id,
                          title: rev.title,
                          content: rev.content,
                          draftContent: rev.draftContent,
                          contentFormat: rev.contentFormat as "plain" | "markdown",
                          draftContentFormat: rev.draftContentFormat as "plain" | "markdown" | null,
                          status: rev.status as any,
                          visibility: rev.visibility as any,
                          isSpoiler: rev.isSpoiler,
                          ratingId: ownerRating?.id || null,
                          shareRating: false,
                          isJournal: true,
                        }}
                        className="text-xs px-2.5 py-1"
                      />
                      {rev.status === "published" && (
                        <Link
                          href={`/review/${rev.id}`}
                          className="text-xs font-semibold text-primary-text hover:underline inline-flex items-center gap-1"
                        >
                          <span>View dispatch</span>
                          <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {rev.title && (
                    <h4 className="font-display text-base uppercase font-bold text-foreground">
                      {rev.title}
                    </h4>
                  )}

                  <SpoilerConcealedText
                    content={displayContent}
                    format={format}
                    isSpoiler={rev.isSpoiler}
                    quoteStyle={true}
                    className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line italic"
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 4: Ranked in Your Collections */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary-text" />
            <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Ranked in Your Collections
            </h3>
            <span className="text-xs font-mono text-muted-foreground ml-1">
              ({ownerRankedCollections.length})
            </span>
          </div>

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
            className="text-xs px-3 py-1.5"
          />
        </div>

        {ownerRankedCollections.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3 bg-card/40">
            <ListOrdered size={28} className="mx-auto text-muted-foreground opacity-50" />
            <p className="font-medium text-sm text-foreground">
              Not ranked in any of your collections yet.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add this title to your custom rankings, favorites, or tier lists.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ownerRankedCollections.map((col) => (
              <Link
                key={col.collectionId}
                href={`/collection/${col.collectionId}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors shadow-xs group"
              >
                <div className="space-y-1 min-w-0 mr-3">
                  <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                    {col.collectionTitle}
                  </h4>
                  {col.notes && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                      {col.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {col.tier && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-xs"
                      style={{ backgroundColor: col.tier.color }}
                    >
                      Tier {col.tier.name}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-bold text-foreground font-mono">
                    #{col.sortOrder + 1}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
