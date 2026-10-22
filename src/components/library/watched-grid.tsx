"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Star, History, Plus, Search, Filter } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { getPersonalMediaUrl } from "@/lib/media-url";
import { RewatchHistoryModal } from "./rewatch-history-modal";
import { LogViewingDialog } from "./log-viewing-dialog";

export interface WatchedItem {
  id: string;
  title: string;
  year?: number | null;
  mediaType?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  posterPath?: string | null;
  stillPath?: string | null;
  viewingCount: number;
  userRating?: number | null;
  lastWatchedDate?: string | null;
}

interface WatchedGridProps {
  initialItems: WatchedItem[];
  onLogViewing?: (item: WatchedItem) => void;
}

export function WatchedGrid({ initialItems }: WatchedGridProps) {
  const [items, setItems] = useState<WatchedItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "title">("recent");

  const [selectedHistoryMedia, setSelectedHistoryMedia] = useState<WatchedItem | null>(null);
  const [logModalMedia, setLogModalMedia] = useState<any | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter((item) => {
      const isEpisode =
        item.mediaType === "episode" ||
        Boolean(item.seasonNumber && item.episodeNumber);

      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }
      if (typeFilter === "movie") {
        return item.mediaType === "movie" || (!isEpisode && item.mediaType !== "tv");
      }
      if (typeFilter === "tv") {
        return isEpisode || item.mediaType === "tv";
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "rating") {
        const rA = a.userRating ?? -1;
        const rB = b.userRating ?? -1;
        return rB - rA;
      }
      // default: recent
      const dateA = a.lastWatchedDate || "";
      const dateB = b.lastWatchedDate || "";
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [items, search, typeFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Watched Titles
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} unique films and episodes you&apos;ve seen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search watched..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-input bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-48"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-surface p-0.5 rounded-button border border-border text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "movie", label: "Films" },
                { id: "tv", label: "Episodes" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  typeFilter === t.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-surface border border-border rounded-input px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="recent">Recently Watched</option>
              <option value="rating">Highest Rated</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No watched titles match your search or filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAndSortedItems.map((item) => {
            const isEpisode =
              item.mediaType === "episode" ||
              Boolean(item.seasonNumber && item.episodeNumber);

            return (
              <div
                key={item.id}
                className="group rounded-card border border-border bg-card overflow-hidden shadow-card hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                {/* Artwork Poster */}
                <div className="relative">
                  <Link href={getPersonalMediaUrl(item.id, { from: "/?tab=watched" })}>
                    <CinematicMediaCard
                      title={item.title}
                      posterPath={isEpisode ? item.stillPath || item.posterPath : item.posterPath}
                      stillPath={item.stillPath}
                      aspect={isEpisode ? "video" : "poster"}
                      className="transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  </Link>

                  {/* Badges on artwork */}
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
                    {item.viewingCount > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-background/90 backdrop-blur-md border border-primary/30 text-primary text-[10px] font-bold">
                        {item.viewingCount} viewings
                      </span>
                    )}
                    {item.userRating !== null && item.userRating !== undefined && (
                      <span className="px-1.5 py-0.5 rounded bg-background/90 backdrop-blur-md border border-border text-primary text-[10px] font-bold flex items-center gap-0.5">
                        <Star size={10} className="fill-primary" />
                        <span>{(item.userRating <= 5 ? item.userRating : item.userRating / 2).toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Info */}
                <div className="p-3 space-y-1">
                  <h4 className="font-display text-base uppercase tracking-tight text-foreground truncate">
                    <Link
                      href={getPersonalMediaUrl(item.id, { from: "/?tab=watched" })}
                      className="hover:text-primary transition-colors"
                    >
                      {item.title}
                    </Link>
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.year || "—"}</span>
                    <span className="uppercase text-[9px] font-semibold text-primary">
                      {isEpisode
                        ? item.seasonNumber && item.episodeNumber
                          ? `S${item.seasonNumber} · E${item.episodeNumber}`
                          : "Episode"
                        : item.mediaType === "tv"
                        ? "TV Series"
                        : "Film"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryMedia(item)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <History size={11} />
                      <span>History</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLogModalMedia(item)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Log another viewing"
                    >
                      <Plus size={11} />
                      <span>Log</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rewatch History Modal */}
      {selectedHistoryMedia && (
        <RewatchHistoryModal
          isOpen={true}
          onClose={() => setSelectedHistoryMedia(null)}
          mediaItem={selectedHistoryMedia}
          onLogNewViewing={(media) => {
            setSelectedHistoryMedia(null);
            setLogModalMedia(media);
          }}
        />
      )}

      {/* Log Viewing Dialog */}
      {logModalMedia && (
        <LogViewingDialog
          isOpen={true}
          onClose={() => setLogModalMedia(null)}
          mediaItem={logModalMedia}
          onSaved={(entry) => {
            setItems((prev) =>
              prev.map((it) =>
                it.id === logModalMedia.id
                  ? {
                      ...it,
                      viewingCount: it.viewingCount + 1,
                      userRating:
                        entry.ratingValue !== null && entry.ratingValue !== undefined
                          ? entry.ratingValue
                          : it.userRating,
                      lastWatchedDate: entry.watchedDate || it.lastWatchedDate,
                    }
                  : it
              )
            );
            setLogModalMedia(null);
          }}
        />
      )}
    </div>
  );
}
