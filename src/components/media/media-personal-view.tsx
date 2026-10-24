"use client";

import { latestDatedRatedReview, personalReviewScore } from "@/lib/review-rating";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { WriteReviewButton, JournalTriggerButton } from "@/components/reviews/write-review-button";
import { ReviewEditorDialog } from "@/components/reviews/review-editor-dialog";
import { AddToRankingButton } from "@/components/collections/add-to-ranking-dialog";
import { MediaWatchlistButton } from "./media-watchlist-button";
import { MediaNotesCard } from "./media-notes-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { getPublicMediaUrl } from "@/lib/media-url";

export interface PersonalRatingData {
  id: string;
  calculatedOverallScore?: number | null;
  normalizedScore?: number | null;
  sourceRating?: number | null;
  sourceScale?: number | null;
  sourceService?: string | null;
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
  isJournal: boolean;
  shareRating: boolean;
  ratingId?: string | null;
  score?: number | null;
  tierName?: string | null;
  tierColor?: string | null;
  ratingValue?: number | null;
  sourceRating?: number | null;
  sourceScale?: number | null;
  viewingId?: string | null;
  sourceService?: string | null;
  sourceReviewDate?: string | null;
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
  ownerJournalReview: PersonalReviewData | null;
  ownerReviews: PersonalReviewData[];
  ownerDiaryEntries: PersonalDiaryData[];
  ownerRankedCollections: PersonalCollectionRankData[];
  shouldAutoOpen: boolean;
  universalNote?: string | null;
}

export function MediaPersonalView({
  media,
  journalMediaId,
  isWatchlist,
  ownerRating,
  ownerJournalReview,
  ownerReviews,
  ownerDiaryEntries,
  ownerRankedCollections,
  shouldAutoOpen,
  universalNote,
}: MediaPersonalViewProps) {
  const router = useRouter();
  const [editingReview, setEditingReview] = useState<PersonalReviewData | null>(null);
  const [isWritingNewReview, setIsWritingNewReview] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  const toggleReviewExpanded = (id: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchParams = useSearchParams();
  const isTv = media.mediaType === "tv";
  const publicOverviewUrl = getPublicMediaUrl(media.id, { from: searchParams?.get("from") || undefined });

  // Latest rated review score is the user's primary review rating
  const latestRatedReview = latestDatedRatedReview(ownerReviews);
  const latestReviewScore = latestRatedReview ? personalReviewScore(latestRatedReview) : null;

  const displayScore = latestReviewScore ?? ownerRating?.normalizedScore ?? null;
  const isImportedRating = Boolean(!latestRatedReview && ownerRating?.sourceRating !== null && ownerRating?.sourceRating !== undefined);
  const hasRatingContent = displayScore !== null || Boolean(ownerRating?.tier);

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
              isCanonical
              buttonId="canonical-journal-button"
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
                      ratingId: ownerJournalReview.ratingId ?? (ownerRating?.id || null),
                      score: ownerJournalReview.score ?? ownerRating?.calculatedOverallScore ?? null,
                      tierName: ownerJournalReview.tierName ?? ownerRating?.tier?.name ?? null,
                      tierColor: ownerJournalReview.tierColor ?? ownerRating?.tier?.color ?? null,
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
                {latestRatedReview ? "Your Review Score" : "Standalone Rating"}
              </h3>
            </div>
            {ownerRating && !latestRatedReview && (
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Standalone
              </span>
            )}
          </div>

          {hasRatingContent ? (
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                {displayScore !== null && (
                  <>
                    <span className="text-4xl font-display font-extrabold text-primary-text">
                      ★ {displayScore.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground font-semibold">
                      / 10
                    </span>
                  </>
                )}
                {!latestRatedReview && ownerRating?.tier && (
                  <span
                    className={`${displayScore !== null ? "ml-auto" : ""} px-2 py-0.5 rounded text-xs font-mono font-bold text-white shadow-xs`}
                    style={{ backgroundColor: ownerRating.tier.color }}
                  >
                    Tier {ownerRating.tier.name}
                  </span>
                )}
              </div>

              {latestRatedReview && <p className="text-xs text-muted-foreground">Latest dated rated {latestRatedReview.sourceService === "letterboxd" ? "Letterboxd " : ""}review · {latestRatedReview.sourceReviewDate || new Date(latestRatedReview.publishedAt!).toLocaleDateString()}</p>}
              {isImportedRating && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded bg-surface border border-border font-medium text-foreground">
                    Imported from {ownerRating?.sourceService === "letterboxd" ? "Letterboxd" : (ownerRating?.sourceService || "Letterboxd")}
                  </span>
                  <span>
                    Original: {ownerRating?.sourceRating} / {ownerRating?.sourceScale || 5} stars
                  </span>
                </div>
              )}

              {ownerRating?.ratingSystemName && !isImportedRating && !latestRatedReview && (
                <p className="text-xs text-muted-foreground">
                  Using system: <strong className="text-foreground">{ownerRating.ratingSystemName}</strong>
                </p>
              )}

              {/* Multi-criteria category scores if present */}
              {!latestRatedReview && ownerRating?.categoryScores && ownerRating.categoryScores.length > 0 && (
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

              {ownerRating?.personalNotes && (
                <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider">
                    Legacy Rating Notes (read only)
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
                <JournalTriggerButton
                  label="Rate in Journal"
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
                <JournalTriggerButton
                  label="Add Viewing"
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

      {/* Universal Notes Section */}
      <MediaNotesCard
        mediaItemId={journalMediaId}
        initialNotes={universalNote ?? ""}
      />

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
          <button
            type="button"
            onClick={() => setIsWritingNewReview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <Plus size={13} />
            <span>Write New Review</span>
          </button>
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
            <button
              type="button"
              onClick={() => setIsWritingNewReview(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs mt-2"
            >
              <Plus size={14} />
              <span>Write Your First Review</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ownerReviews.map((rev) => {
              const displayContent = rev.draftContent || rev.content;
              const format = (rev.draftContentFormat || rev.contentFormat || "plain") as "plain" | "markdown";
              const isExpanded = expandedReviews.has(rev.id);
              const isLong = displayContent.length > 300;
              const reviewScore = personalReviewScore(rev);

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

                      {reviewScore !== null && typeof reviewScore === "number" && (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono font-bold text-xs">
                          ★ {reviewScore.toFixed(1)}/10
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingReview(rev)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-foreground border border-border font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Pencil size={12} />
                        <span>Edit Review</span>
                      </button>
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

                  <div className="space-y-1">
                    <SpoilerConcealedText
                      content={isLong && !isExpanded ? `${displayContent.slice(0, 300)}...` : displayContent}
                      format={format}
                      isSpoiler={rev.isSpoiler}
                      quoteStyle={true}
                      className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line italic"
                    />
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleReviewExpanded(rev.id)}
                        className="inline-flex items-center gap-1 text-primary-text hover:underline text-xs font-semibold cursor-pointer pt-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} />
                            <span>Show less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} />
                            <span>Read full review ({displayContent.length} chars)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
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

      {/* Focused Review Editor Dialog for Editing Any Review */}
      {editingReview && (
        <ReviewEditorDialog
          isOpen={Boolean(editingReview)}
          onClose={() => setEditingReview(null)}
          mediaItemId={journalMediaId}
          mediaTitle={media.title}
          posterPath={media.posterPath || media.stillPath}
          existingReview={{
            id: editingReview.id,
            title: editingReview.title,
            content: editingReview.content,
            draftContent: editingReview.draftContent,
            contentFormat: (editingReview.draftContent ? editingReview.draftContentFormat || editingReview.contentFormat : editingReview.contentFormat) as any,
            draftContentFormat: editingReview.draftContentFormat as any,
            status: editingReview.status as any,
            visibility: editingReview.visibility as any,
            isSpoiler: editingReview.isSpoiler,
            ratingId: editingReview.ratingId ?? null,
            score: editingReview.score ?? null,
            tierName: editingReview.tierName ?? null,
            tierColor: editingReview.tierColor ?? null,
            shareRating: editingReview.shareRating,
            isJournal: editingReview.isJournal,
            viewingId: editingReview.viewingId ?? null,
            sourceRating: editingReview.sourceRating ?? null,
            sourceScale: editingReview.sourceScale ?? null,
            ratingValue: editingReview.ratingValue ?? null,
          }}
          journalMode={editingReview.isJournal}
          initialQuickScore={editingReview.isJournal ? (ownerRating?.calculatedOverallScore ?? null) : null}
          onSaved={() => {
            setEditingReview(null);
            router.refresh();
          }}
          onDeleted={() => {
            setEditingReview(null);
            router.refresh();
          }}
        />
      )}

      {/* Review Editor Dialog for Writing a New Review */}
      {isWritingNewReview && (
        <ReviewEditorDialog
          isOpen={isWritingNewReview}
          onClose={() => setIsWritingNewReview(false)}
          mediaItemId={journalMediaId}
          mediaTitle={media.title}
          posterPath={media.posterPath || media.stillPath}
          existingReview={null}
          journalMode={false}
          onSaved={() => {
            setIsWritingNewReview(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
