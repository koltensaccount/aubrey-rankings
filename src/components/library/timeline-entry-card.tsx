"use client";

import Link from "next/link";
import { Star, History, Lock, Globe, Link2, Edit2, Calendar } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import type { DiaryViewingEvent } from "./rewatch-history-modal";

interface TimelineEntryCardProps {
  entry: DiaryViewingEvent & {
    mediaItem: {
      id: string;
      title: string;
      year?: number | null;
      releaseDate?: string | null;
      mediaType?: string | null;
      posterPath?: string | null;
      stillPath?: string | null;
    };
  };
  ordinalIndex: number; // 1-based index among all logged viewings of this title
  totalViewingsForMedia: number;
  onOpenHistory: (mediaItem: any) => void;
  onEditEntry?: (entry: any) => void;
}

export function TimelineEntryCard({
  entry,
  ordinalIndex,
  totalViewingsForMedia,
  onOpenHistory,
  onEditEntry,
}: TimelineEntryCardProps) {
  const { mediaItem } = entry;
  const isRewatch = entry.isRewatch || ordinalIndex > 1;

  const ordinalSuffix =
    ordinalIndex === 1
      ? "1st"
      : ordinalIndex === 2
      ? "2nd"
      : ordinalIndex === 3
      ? "3rd"
      : `${ordinalIndex}th`;

  // Parse date into Day and Month
  let day = "";
  let month = "";
  if (entry.watchedDate) {
    const parts = entry.watchedDate.split("-");
    if (parts.length === 3) {
      day = parts[2];
      const monthNum = parseInt(parts[1], 10);
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      month = months[monthNum - 1] || "";
    }
  } else if (entry.loggedDate) {
    const d = new Date(entry.loggedDate);
    day = String(d.getDate()).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    month = months[d.getMonth()] || "";
  }

  // Display rating
  const ratingScore =
    typeof entry.ratingValue === "number"
      ? entry.ratingValue
      : typeof entry.rating?.calculatedOverallScore === "number"
      ? entry.rating.calculatedOverallScore
      : typeof entry.rating?.sourceRating === "number"
      ? entry.rating.sourceRating
      : null;

  // Visibility indicator
  const visibility = entry.review?.visibility || "private";

  return (
    <div className="relative flex items-start group">
      {/* Date Rail (Narrow column on the left) */}
      <div className="w-12 sm:w-16 shrink-0 pt-3 text-right pr-3 sm:pr-4 select-none">
        <span className="block font-display text-lg sm:text-2xl font-bold tracking-tight text-foreground leading-none">
          {day || "—"}
        </span>
        <span className="block text-[10px] sm:text-[11px] font-bold text-muted-foreground tracking-wider uppercase mt-0.5">
          {month}
        </span>
      </div>

      {/* Timeline Node (Positioned on the connecting line) */}
      <div className="relative shrink-0 flex items-center justify-center pt-4 z-10">
        <div
          className={`w-3 h-3 rounded-full border-2 transition-transform duration-200 group-hover:scale-125 ${
            isRewatch
              ? "bg-primary border-primary"
              : "bg-card border-primary"
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Media Card on the Right */}
      <div className="flex-1 ml-3 sm:ml-5 pb-6 min-w-0">
        <div className="p-3.5 sm:p-5 rounded-card bg-card border border-border shadow-card hover:border-primary/40 transition-all duration-200 space-y-3">
          <div className="flex items-start gap-3.5 sm:gap-4">
            {/* Artwork Poster or Episode Still */}
            <Link
              href={`/media/${encodeURIComponent(mediaItem.id)}`}
              className="shrink-0 w-16 sm:w-20 hover:opacity-90 transition-opacity"
            >
              <CinematicMediaCard
                title={mediaItem.title}
                posterPath={mediaItem.posterPath}
                stillPath={mediaItem.stillPath}
                aspect={mediaItem.mediaType === "tv_episode" ? "video" : "poster"}
                className="rounded shadow-sm"
              />
            </Link>

            {/* Media Information */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Metadata Row above Title */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {(mediaItem.year || (mediaItem.releaseDate ? mediaItem.releaseDate.slice(0, 4) : null)) && (
                  <span>{mediaItem.year || mediaItem.releaseDate?.slice(0, 4)}</span>
                )}
                {mediaItem.mediaType && (
                  <>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="uppercase text-[9px] font-bold tracking-wider">
                      {mediaItem.mediaType === "tv_episode" ? "Episode" : "Film"}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground/60">·</span>
                {/* Viewing Status Badge */}
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    isRewatch
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-surface-raised text-muted-foreground border border-border"
                  }`}
                >
                  {isRewatch ? `Rewatch · ${ordinalSuffix} Logged Viewing` : "1st Logged Viewing"}
                </span>
              </div>

              {/* Title in Barlow Condensed */}
              <h3 className="font-display text-xl sm:text-2xl uppercase tracking-tight text-foreground truncate">
                <Link
                  href={`/media/${encodeURIComponent(mediaItem.id)}`}
                  className="hover:text-primary transition-colors"
                >
                  {mediaItem.title}
                </Link>
              </h3>

              {/* Rating Display */}
              {ratingScore !== null && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <div className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary">
                    <Star size={13} className="fill-primary text-primary" />
                    <span>{ratingScore.toFixed(1)} / 10</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes or Review Excerpt */}
          {(entry.notes || entry.review?.content) && (
            <div className="text-xs sm:text-sm text-foreground/90 italic pt-1 border-t border-border/60">
              <SpoilerConcealedText
                content={entry.notes || entry.review?.content}
                isSpoiler={entry.review?.isSpoiler}
                quoteStyle
              />
            </div>
          )}

          {/* Tags */}
          {Array.isArray(entry.tags) && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {entry.tags.map((tag, tIdx) => (
                <span
                  key={tIdx}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-muted-foreground border border-border"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer Controls: Visibility + History Exploration + Edit */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
            {/* Visibility Indicator */}
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              {visibility === "public" ? (
                <>
                  <Globe size={12} className="text-primary" />
                  <span>Public</span>
                </>
              ) : visibility === "unlisted" ? (
                <>
                  <Link2 size={12} />
                  <span>Unlisted</span>
                </>
              ) : (
                <>
                  <Lock size={12} />
                  <span>Private</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenHistory(mediaItem)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                <History size={12} />
                <span>
                  View history {totalViewingsForMedia > 1 ? `(${totalViewingsForMedia})` : ""}
                </span>
              </button>

              {onEditEntry && (
                <button
                  type="button"
                  onClick={() => onEditEntry(entry)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Edit2 size={11} />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
