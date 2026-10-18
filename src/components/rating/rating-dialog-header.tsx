"use client";

import { X } from "lucide-react";

interface RatingDialogHeaderProps {
  title: string;
  backdropUrl: string | null;
  isEpisode: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
  onClose: () => void;
}

export function RatingDialogHeader({
  title,
  backdropUrl,
  isEpisode,
  seasonNumber,
  episodeNumber,
  onClose,
}: RatingDialogHeaderProps) {
  return (
    <div className="relative h-44 sm:h-52 w-full bg-card shrink-0 overflow-hidden">
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover object-center opacity-90 dark:opacity-85 filter saturate-[0.95]"
        />
      ) : (
        <div className="w-full h-full bg-surface" />
      )}

      {/* Shorter localized bottom fade to transition into dialog surface */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/60 to-transparent pointer-events-none" />

      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="absolute top-3 right-3 h-8 w-8 rounded-full bg-card/80 backdrop-blur-md text-foreground hover:bg-muted flex items-center justify-center border border-border transition-colors cursor-pointer z-10 shadow-sm"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header Title Metadata */}
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-4 z-10">
        <div className="space-y-1 min-w-0">
          {isEpisode && (
            <span className="inline-block px-2.5 py-0.5 rounded-badge bg-card/90 backdrop-blur-sm border border-border text-[10px] text-primary font-semibold tracking-wider uppercase">
              Season {seasonNumber} · Episode {episodeNumber}
            </span>
          )}
          <h2
            id="rating-dialog-title"
            className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          >
            {title}
          </h2>
        </div>
      </div>
    </div>
  );
}
