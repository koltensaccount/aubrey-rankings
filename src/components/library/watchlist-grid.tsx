"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, Search, Trash2, Plus, Film, BookmarkX } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { getPersonalMediaUrl } from "@/lib/media-url";
import { LogViewingDialog } from "./log-viewing-dialog";

export interface WatchlistGridItem {
  id: string; // watchlistItem.id
  mediaItemId: string;
  createdAt: string | Date;
  notes?: string | null;
  mediaItem: {
    id: string;
    title: string;
    year?: number | null;
    mediaType?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    posterPath?: string | null;
    stillPath?: string | null;
  };
}

interface WatchlistGridProps {
  items: WatchlistGridItem[];
  onItemRemoved?: (id: string) => void;
  onItemLogged?: () => void;
}

export function WatchlistGrid({ items: initialItems, onItemRemoved, onItemLogged }: WatchlistGridProps) {
  const [items, setItems] = useState<WatchlistGridItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "year">("date");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loggingMediaItem, setLoggingMediaItem] = useState<any | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.mediaItem.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.mediaItem.title.localeCompare(b.mediaItem.title);
      }
      if (sortBy === "year") {
        return (b.mediaItem.year || 0) - (a.mediaItem.year || 0);
      }
      // default: date added descending
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return result;
  }, [items, search, sortBy]);

  const handleRemove = async (item: WatchlistGridItem) => {
    setRemovingId(item.id);
    try {
      const res = await fetch(`/api/watchlist?mediaItemId=${encodeURIComponent(item.mediaItemId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        if (onItemRemoved) onItemRemoved(item.id);
      }
    } catch (err) {
      console.error("Failed to remove from watchlist:", err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Watchlist
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} titles you want to watch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-input bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-48"
            />
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-input bg-surface border border-border text-foreground text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="date">Date Added (Newest)</option>
            <option value="title">Title (A-Z)</option>
            <option value="year">Release Year</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-card/50 p-8 space-y-3 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
            <Bookmark size={20} />
          </div>
          <h3 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Your Watchlist is Empty
          </h3>
          <p className="text-xs text-muted-foreground">
            Save films and television series you want to watch from Discover or title detail pages.
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
          No watchlist items match your search.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAndSortedItems.map((item) => {
            const isEpisode =
              item.mediaItem.mediaType === "episode" ||
              Boolean(item.mediaItem.seasonNumber && item.mediaItem.episodeNumber);

            return (
              <div
                key={item.id}
                className="group rounded-card border border-border bg-card overflow-hidden shadow-card hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                {/* Poster Artwork */}
                <div className="relative">
                  <Link href={getPersonalMediaUrl(item.mediaItem.id, { from: "/?tab=watchlist" })}>
                    <CinematicMediaCard
                      title={item.mediaItem.title}
                      posterPath={isEpisode ? item.mediaItem.stillPath || item.mediaItem.posterPath : item.mediaItem.posterPath}
                      stillPath={item.mediaItem.stillPath}
                      aspect={isEpisode ? "video" : "poster"}
                      className="transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  </Link>

                  <div className="absolute top-2 right-2 pointer-events-none">
                    <span className="p-1 rounded-full bg-background/90 backdrop-blur-md border border-border text-primary inline-flex">
                      <Bookmark size={11} className="fill-primary" />
                    </span>
                  </div>
                </div>

                {/* Title & Info */}
                <div className="p-3 space-y-1">
                  <h4 className="font-display text-base uppercase tracking-tight text-foreground truncate">
                    <Link
                      href={getPersonalMediaUrl(item.mediaItem.id, { from: "/?tab=watchlist" })}
                      className="hover:text-primary transition-colors"
                    >
                      {item.mediaItem.title}
                    </Link>
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.mediaItem.year || "—"}</span>
                    <span className="uppercase text-[9px] font-semibold text-primary">
                      {isEpisode
                        ? item.mediaItem.seasonNumber && item.mediaItem.episodeNumber
                          ? `S${item.mediaItem.seasonNumber} · E${item.mediaItem.episodeNumber}`
                          : "Episode"
                        : item.mediaItem.mediaType === "tv"
                        ? "TV Series"
                        : "Film"}
                    </span>
                  </div>

                {/* Actions */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setLoggingMediaItem(item.mediaItem)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Log viewing</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={removingId === item.id}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title="Remove from watchlist"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Log Viewing Dialog */}
      {loggingMediaItem && (
        <LogViewingDialog
          isOpen={Boolean(loggingMediaItem)}
          onClose={() => setLoggingMediaItem(null)}
          mediaItem={loggingMediaItem}
          onSaved={() => {
            setLoggingMediaItem(null);
            if (onItemLogged) onItemLogged();
          }}
        />
      )}
    </div>
  );
}
