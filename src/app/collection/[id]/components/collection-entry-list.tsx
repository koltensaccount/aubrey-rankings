"use client";

import React from "react";
import { Plus, Sliders, Trash2 } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

interface CollectionEntryListProps {
  processedEntries: any[];
  collection: any;
  viewMode: "list" | "editorial" | "compact";
  isOwner: boolean;
  onOpenAddModal: () => void;
  onSelectItemForRating: (media: any) => void;
  onSetEntryToDelete: (entry: any) => void;
}

export function CollectionEntryList({
  processedEntries,
  collection,
  viewMode,
  isOwner,
  onOpenAddModal,
  onSelectItemForRating,
  onSetEntryToDelete,
}: CollectionEntryListProps) {
  if (processedEntries.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-border rounded-card space-y-3">
        <p className="text-sm text-muted-foreground">No items in this ranking collection.</p>
        {isOwner && (
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>Add Your First Item</span>
          </button>
        )}
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="divide-y divide-border border-t border-border">
        {processedEntries.map((entry: any, index: number) => {
          const media = entry.mediaItem;
          const { state, score, actionLabel, scoredCount, totalCategories } = entry.ratingStatus;
          const isMovie =
            media.mediaType === "movie" ||
            collection.collectionType === "movie_franchise" ||
            (media.mediaType !== "episode" && !media.stillPath && Boolean(media.posterPath));

          return (
            <div
              key={entry.id}
              className="relative grid grid-cols-[1.5rem_5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:flex items-center sm:gap-6 py-4 hover:bg-surface/40 px-2 sm:px-3 -mx-2 sm:-mx-3 rounded-card transition-colors group"
            >
              {/* Rank Numeral */}
              <span className="row-span-2 w-6 sm:w-10 text-center font-display text-2xl sm:text-3xl font-bold text-muted-foreground/70 group-hover:text-primary-text transition-colors shrink-0">
                {index < 9 ? `0${index + 1}` : index + 1}
              </span>

              {/* Cinematic Card: 2:3 Portrait for Movies, 16:9 for Episodes */}
              <div className={isMovie ? "row-span-2 w-20 sm:w-[84px] shrink-0" : "row-span-2 w-20 sm:w-36 shrink-0"}>
                <CinematicMediaCard
                  stillPath={media.stillPath}
                  posterPath={media.posterPath}
                  title={media.title}
                  aspect={isMovie ? "poster" : "video"}
                />
              </div>

              {/* Title & Metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                  {media.seasonNumber && media.episodeNumber && (
                    <span>
                      Season {media.seasonNumber} · Episode {media.episodeNumber}
                    </span>
                  )}
                  {media.releaseDate && <span>· {media.releaseDate.split("-")[0]}</span>}
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground uppercase tracking-tight truncate mt-0.5 group-hover:text-primary-text transition-colors">
                  {media.title}
                </h3>
                {entry.userRating?.reviewText && (
                  <p className="text-xs text-muted-foreground line-clamp-1 italic mt-1">
                    &ldquo;{entry.userRating.reviewText}&rdquo;
                  </p>
                )}
              </div>

              {/* Score & Rate Button */}
              <div className="col-start-3 flex items-center justify-between sm:justify-start gap-3 sm:gap-4 shrink-0">
                <div className="text-right">
                  {state === "rated" && score !== null ? (
                    <div className="font-display text-2xl sm:text-3xl font-bold text-primary-text">
                      {score.toFixed(1)}
                      <span className="text-[11px] text-muted-foreground/70 ml-1 font-sans font-normal">
                        / {entry.userRating?.categoryScores?.length ? (entry.userRating?.ratingSystem?.scale ?? collection.defaultRatingSystem?.scale ?? 10) : (entry.userRating?.sourceScale ?? 10)}
                      </span>
                    </div>
                  ) : state === "in_progress" ? (
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 uppercase tracking-wider">
                        {scoredCount}/{totalCategories} Rated
                      </span>
                      {score !== null && (
                        <div className="font-display text-base font-bold text-amber-500/90 dark:text-amber-400/90 mt-0.5">
                          ★ {score.toFixed(1)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 font-medium">—</span>
                  )}
                </div>

                {isOwner && (
                  <button
                    onClick={() => onSelectItemForRating(media)}
                    className={`px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      state === "rated"
                        ? "bg-surface hover:bg-surface-elevated text-foreground border-border"
                        : state === "in_progress"
                          ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-primary hover:bg-primary-hover text-primary-foreground border-primary shadow-sm"
                    }`}
                  >
                    <Sliders size={13} />
                    <span className="hidden sm:inline">{actionLabel}</span>
                    <span className="sm:hidden">{state === "rated" ? "Edit" : state === "in_progress" ? "Cont." : "Rate"}</span>
                  </button>
                )}

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => onSetEntryToDelete(entry)}
                    className="absolute right-0 top-3 sm:static p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors cursor-pointer"
                    title="Remove from this ranking"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* Editorial Grid View */
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {processedEntries.map((entry: any, index: number) => {
        const media = entry.mediaItem;
        const { state, score, actionLabel, scoredCount, totalCategories } = entry.ratingStatus;
        const isMovie =
          collection.collectionType === "movie_franchise" ||
          media.mediaType === "movie" ||
          (media.mediaType !== "episode" && !media.stillPath);

        return (
          <div
            key={entry.id}
            className={`rounded-card border overflow-hidden flex flex-col justify-between group transition-colors ${
              state === "rated"
                ? "border-border-card bg-card hover:border-primary/50 shadow-card"
                : state === "in_progress"
                  ? "border-amber-500/30 bg-surface hover:border-amber-500/50"
                  : "border-border-card bg-surface/50 hover:border-border"
            }`}
          >
            <div className="relative overflow-hidden">
              <CinematicMediaCard
                stillPath={media.stillPath}
                posterPath={media.posterPath}
                title={media.title}
                aspect={isMovie ? "poster" : "video"}
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md font-display text-lg text-white border border-white/10">
                #{index < 9 ? `0${index + 1}` : index + 1}
              </div>

              {/* State Badge Top Right */}
              {state === "rated" && score !== null ? (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-primary/40 text-primary-text font-display text-base shadow-lg">
                  ★ {score.toFixed(1)}
                </div>
              ) : state === "in_progress" ? (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-amber-500/50 text-amber-300 font-display text-xs tracking-wider uppercase font-bold shadow-lg">
                  {scoredCount}/{totalCategories} Rated
                </div>
              ) : (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-border text-muted-foreground text-[10px] uppercase font-semibold">
                  Unrated
                </div>
              )}
            </div>

            <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground block">
                  {media.seasonNumber ? `Season ${media.seasonNumber}, Ep ${media.episodeNumber}` : "Movie"}
                </span>
                <h3 className="font-display text-xl font-bold text-foreground uppercase tracking-tight mt-0.5 truncate">
                  {media.title}
                </h3>
              </div>

              {isOwner ? (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => onSelectItemForRating(media)}
                    className={`flex-1 py-2 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      state === "rated"
                        ? "bg-secondary hover:bg-surface text-foreground border border-border"
                        : state === "in_progress"
                          ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                          : "bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm"
                    }`}
                  >
                    <Sliders size={13} />
                    <span>{actionLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetEntryToDelete(entry)}
                    className="p-2 rounded-button text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 transition-colors cursor-pointer"
                    title="Remove from this ranking"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : entry.userRating?.reviewText ? (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground italic line-clamp-2">
                    &ldquo;{entry.userRating.reviewText}&rdquo;
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
