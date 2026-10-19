"use client";

import { CinematicMediaCard } from "@/components/cinematic-media-card";

import React from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

interface CollectionAddEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collection: any;
  drilldownSeason: any;
  setDrilldownSeason: (val: any) => void;
  selectedTvShow: any;
  setSelectedTvShow: (val: any) => void;
  tvSeasonData: any;
  setTvSeasonData: (val: any) => void;
  loadingSeasonData: boolean;
  loadingTvDetails: boolean;
  addingMediaId: number | null;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchResults: any[];
  isSearchingTmdb: boolean;
  handleAddTvEpisode: (ep: any) => void;
  handleSelectSeason: (season: any) => void;
  handleSelectTvShow: (item: any) => void;
  handleAddTmdbItem: (item: any) => void;
}

export function CollectionAddEntryDialog({
  isOpen,
  onClose,
  collection,
  drilldownSeason,
  setDrilldownSeason,
  selectedTvShow,
  setSelectedTvShow,
  tvSeasonData,
  setTvSeasonData,
  loadingSeasonData,
  loadingTvDetails,
  addingMediaId,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearchingTmdb,
  handleAddTvEpisode,
  handleSelectSeason,
  handleSelectTvShow,
  handleAddTmdbItem,
}: CollectionAddEntryDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-dialog bg-card border border-border-dialog p-6 shadow-dialog space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-xl uppercase font-bold text-foreground">
              {drilldownSeason
                ? `${selectedTvShow?.name || "TV Show"} · ${drilldownSeason.name}`
                : selectedTvShow
                  ? `${selectedTvShow.name || "TV Show"} · Seasons`
                  : "Add Entry to Ranking"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {drilldownSeason
                ? "Select individual episodes to add to your ranking."
                : selectedTvShow
                  ? "Choose a season to view and rate its episodes."
                  : "Search TMDB to add movies or TV episodes directly into this ranking."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Level 3: Episode Selection */}
        {drilldownSeason && selectedTvShow ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setDrilldownSeason(null);
                setTvSeasonData(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-primary-text hover:underline cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Seasons</span>
            </button>

            {loadingSeasonData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={20} className="animate-spin text-primary" />
                <span>Loading episodes...</span>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {tvSeasonData?.episodes?.map((ep: any) => {
                  const isAlreadyIn = (collection.entries || []).some(
                    (e: any) =>
                      e.mediaItem?.seasonNumber === ep.season_number &&
                      e.mediaItem?.episodeNumber === ep.episode_number &&
                      e.mediaItem?.title === ep.name
                  );
                  const isAdding = addingMediaId === ep.id;

                  return (
                    <div
                      key={ep.id}
                      className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-16 shrink-0">
                          <CinematicMediaCard stillPath={ep.still_path} title={ep.name} aspect="video" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs text-foreground truncate">
                            Ep {ep.episode_number}: {ep.name}
                          </h4>
                          {ep.air_date && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              {ep.air_date.split("-")[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddTvEpisode(ep)}
                        disabled={isAlreadyIn || isAdding}
                        className={`px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          isAlreadyIn
                            ? "bg-surface text-muted-foreground border border-border cursor-not-allowed"
                            : "bg-secondary hover:bg-surface text-foreground border border-border"
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : isAlreadyIn ? (
                          <>
                            <Check size={12} />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={12} />
                            <span>Add Episode</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : selectedTvShow ? (
          /* Level 2: Season Selection */
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setSelectedTvShow(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-primary-text hover:underline cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Search</span>
            </button>

            {loadingTvDetails ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={20} className="animate-spin text-primary" />
                <span>Loading seasons...</span>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {selectedTvShow.seasons
                  ?.filter((s: any) => s.season_number > 0)
                  .map((season: any) => (
                    <div
                      key={season.id}
                      className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 shrink-0">
                          <CinematicMediaCard posterPath={season.poster_path} title={season.name} aspect="poster" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs text-foreground truncate">
                            {season.name}
                          </h4>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {season.episode_count} Episodes
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSeason(season)}
                        className="px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 bg-secondary hover:bg-surface text-foreground border border-border transition-all cursor-pointer shrink-0"
                      >
                        <span>View Episodes</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          /* Level 1: Search Box & General Results */
          <>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies or TV shows (e.g. Alien, Severance)..."
                autoFocus
                className="w-full h-11 pl-9 pr-4 rounded-input bg-surface border border-border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              {isSearchingTmdb && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin"
                />
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearchingTmdb && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No matching titles found on TMDB.
                </div>
              )}

              {searchResults.map((item) => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || "").split("-")[0];
                const isTv = item.media_type === "tv" || (!item.title && item.name);
                const isAlreadyIn = (collection.entries || []).some(
                  (e: any) => e.mediaItem?.tmdbId === item.id
                );
                const isAdding = addingMediaId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 shrink-0">
                          <CinematicMediaCard posterPath={item.poster_path} title={title} aspect="poster" />
                        </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-foreground truncate">
                          {title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {year ? `${year} · ` : ""}{isTv ? "TV Series" : "Movie"}
                        </span>
                      </div>
                    </div>

                    {isTv ? (
                      <button
                        type="button"
                        onClick={() => handleSelectTvShow(item)}
                        className="px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 bg-secondary hover:bg-surface text-foreground border border-border transition-all cursor-pointer shrink-0"
                      >
                        <span>Select Episodes</span>
                        <ChevronRight size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddTmdbItem(item)}
                        disabled={isAlreadyIn || isAdding}
                        className={`px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          isAlreadyIn
                            ? "bg-surface text-muted-foreground border border-border cursor-not-allowed"
                            : "bg-secondary hover:bg-surface text-foreground border border-border"
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : isAlreadyIn ? (
                          <>
                            <Check size={12} />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={12} />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
