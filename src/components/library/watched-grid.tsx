"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Star, History, Plus, Film, Tv, CheckCircle2 } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { RewatchHistoryModal } from "./rewatch-history-modal";
import { LogViewingDialog } from "./log-viewing-dialog";

export interface WatchedItem {
  id: string; // mediaItem.id
  title: string;
  year?: number | null;
  mediaType?: string | null;
  posterPath?: string | null;
  stillPath?: string | null;
  userRating?: number | null;
  viewingCount: number;
  lastWatchedDate?: string | null;
}

interface WatchedGridProps {
  items: WatchedItem[];
  onLogViewing?: () => void;
}

export function WatchedGrid({ items: initialItems, onLogViewing }: WatchedGridProps) {
  const [items, setItems] = useState<WatchedItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "rating">("recent");

  // History and log modal
  const [selectedHistoryMedia, setSelectedHistoryMedia] = useState<any | null>(null);
  const [logModalMedia, setLogModalMedia] = useState<any | null>(null);

  useMemo(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }
      if (typeFilter === "movie") {
        return item.mediaType !== "tv_episode" && item.mediaType !== "tv_show";
      }
      if (typeFilter === "tv") {
        return item.mediaType === "tv_episode" || item.mediaType === "tv_show";
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
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === t.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-input bg-surface border border-border text-foreground text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="recent">Recently Watched</option>
            <option value="title">Title (A-Z)</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-card/50 p-8 space-y-3 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
            <CheckCircle2 size={20} />
          </div>
          <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
            No Watched Titles Yet
          </h3>
          <p className="text-xs text-muted-foreground">
            Search films or TV shows in Discover to mark them as watched and log them to your archive.
          </p>
          <div className="pt-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
            >
              <Film size={14} />
              <span>Explore Discover</span>
            </Link>
          </div>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No watched titles match your search or filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAndSortedItems.map((item) => (
            <div
              key={item.id}
              className="group rounded-card border border-border bg-card overflow-hidden shadow-card hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              {/* Artwork Poster */}
              <div className="relative">
                <Link href={`/media/${encodeURIComponent(item.id)}`}>
                  <CinematicMediaCard
                    title={item.title}
                    posterPath={item.posterPath}
                    stillPath={item.stillPath}
                    aspect={item.mediaType === "tv_episode" ? "video" : "poster"}
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
                      <span>{item.userRating.toFixed(1)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-3 space-y-1">
                <h4 className="font-display text-base uppercase tracking-tight text-foreground truncate">
                  <Link
                    href={`/media/${encodeURIComponent(item.id)}`}
                    className="hover:text-primary transition-colors"
                  >
                    {item.title}
                  </Link>
                </h4>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{item.year || "—"}</span>
                  <span className="uppercase text-[9px] font-semibold">
                    {item.mediaType === "tv_episode" ? "Episode" : "Film"}
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
          ))}
        </div>
      )}

      {/* Rewatch History Modal */}
      {selectedHistoryMedia && (
        <RewatchHistoryModal
          isOpen={Boolean(selectedHistoryMedia)}
          onClose={() => setSelectedHistoryMedia(null)}
          mediaItem={selectedHistoryMedia}
          onLogNewViewing={() => {
            setLogModalMedia(selectedHistoryMedia);
          }}
        />
      )}

      {/* Log Viewing Dialog */}
      {logModalMedia && (
        <LogViewingDialog
          isOpen={Boolean(logModalMedia)}
          onClose={() => setLogModalMedia(null)}
          mediaItem={logModalMedia}
          onSaved={() => {
            setLogModalMedia(null);
            if (onLogViewing) onLogViewing();
          }}
        />
      )}
    </div>
  );
}
