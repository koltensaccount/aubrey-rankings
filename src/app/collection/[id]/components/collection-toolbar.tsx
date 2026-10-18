"use client";

import React from "react";
import { Grid, List, Plus } from "lucide-react";

export type SortOption = "score_desc" | "score_asc" | "order" | "title";
export type FilterOption = "all" | "rated" | "in_progress" | "unrated";

interface CollectionToolbarProps {
  isOwner: boolean;
  onOpenAddModal: () => void;
  filterRated: FilterOption;
  setFilterRated: (filter: FilterOption) => void;
  totalEntries: number;
  completedCount: number;
  inProgressCount: number;
  unratedCount: number;
  availableSeasons: number[];
  selectedSeason: string;
  setSelectedSeason: (season: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  viewMode: "list" | "editorial" | "compact";
  setViewMode: (mode: "list" | "editorial" | "compact") => void;
}

export function CollectionToolbar({
  isOwner,
  onOpenAddModal,
  filterRated,
  setFilterRated,
  totalEntries,
  completedCount,
  inProgressCount,
  unratedCount,
  availableSeasons,
  selectedSeason,
  setSelectedSeason,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
}: CollectionToolbarProps) {
  return (
    <div className="sticky top-20 z-30 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Left: Action, Status Filters, & Season Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {isOwner && (
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 rounded-button bg-secondary hover:bg-surface text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus size={13} />
              <span>Add Item</span>
            </button>
          )}

          {/* Rating Status Filters */}
          <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => setFilterRated("all")}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                filterRated === "all"
                  ? "bg-surface text-primary-text font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({totalEntries})
            </button>
            <button
              type="button"
              onClick={() => setFilterRated("rated")}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                filterRated === "rated"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rated ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterRated("in_progress")}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                filterRated === "in_progress"
                  ? "bg-primary/20 text-primary-text border border-primary/40 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterRated("unrated")}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                filterRated === "unrated"
                  ? "bg-surface text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unrated ({unratedCount})
            </button>
          </div>

          {availableSeasons.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-border">
              <button
                onClick={() => setSelectedSeason("all")}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  selectedSeason === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}
              >
                All seasons
              </button>
              {availableSeasons.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeason(s.toString())}
                  className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                    selectedSeason === s.toString()
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  Season {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Controls: Sort & View Mode */}
        <div className="flex items-center justify-between sm:justify-end gap-3 ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-surface text-xs text-foreground border border-border-input rounded px-3 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value="score_desc">Sort: Highest Score</option>
            <option value="order">Sort: Chronological</option>
            <option value="title">Sort: Alphabetical</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-card p-1 rounded border border-border">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-surface text-primary-text font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("editorial")}
              title="Grid view"
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === "editorial"
                  ? "bg-surface text-primary-text font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
