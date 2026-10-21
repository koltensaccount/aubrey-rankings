"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Star, Film, Tv, Check, Search } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

interface LogViewingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem?: {
    id: string;
    title: string;
    year?: number | null;
    mediaType?: string | null;
    posterPath?: string | null;
    stillPath?: string | null;
  } | null;
  existingEntry?: {
    id: string;
    mediaItemId: string;
    watchedDate?: string | null;
    isRewatch?: boolean;
    ratingValue?: number | null;
    notes?: string | null;
    tags?: string[] | null;
  } | null;
  onSaved: (savedEntry: any) => void;
}

export function LogViewingDialog({
  isOpen,
  onClose,
  mediaItem: initialMediaItem,
  existingEntry,
  onSaved,
}: LogViewingDialogProps) {
  const [selectedMedia, setSelectedMedia] = useState(initialMediaItem || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [watchedDate, setWatchedDate] = useState(
    existingEntry?.watchedDate || new Date().toISOString().slice(0, 10)
  );
  const [isRewatch, setIsRewatch] = useState(existingEntry?.isRewatch || false);
  const [ratingValue, setRatingValue] = useState<number | null>(
    typeof existingEntry?.ratingValue === "number" ? existingEntry.ratingValue : null
  );
  const [notes, setNotes] = useState(existingEntry?.notes || "");
  const [tagInput, setTagInput] = useState(
    Array.isArray(existingEntry?.tags) ? existingEntry.tags.join(", ") : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMediaItem) {
      setSelectedMedia(initialMediaItem);
    }
  }, [initialMediaItem]);

  useEffect(() => {
    if (existingEntry) {
      setWatchedDate(existingEntry.watchedDate || new Date().toISOString().slice(0, 10));
      setIsRewatch(Boolean(existingEntry.isRewatch));
      setRatingValue(typeof existingEntry.ratingValue === "number" ? existingEntry.ratingValue : null);
      setNotes(existingEntry.notes || "");
      setTagInput(Array.isArray(existingEntry.tags) ? existingEntry.tags.join(", ") : "");
    }
  }, [existingEntry]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err: any) {
      console.error("TMDB search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMedia = (item: any) => {
    // Standardize to mediaItem structure
    const isTv = item.media_type === "tv" || Boolean(item.first_air_date);
    const mediaId = `tmdb-${isTv ? "tv" : "movie"}-${item.id}`;
    const year = item.release_date
      ? parseInt(item.release_date.slice(0, 4), 10)
      : item.first_air_date
      ? parseInt(item.first_air_date.slice(0, 4), 10)
      : null;

    setSelectedMedia({
      id: mediaId,
      title: item.title || item.name || "Untitled",
      year,
      mediaType: isTv ? "tv_show" : "movie",
      posterPath: item.poster_path,
      stillPath: item.backdrop_path,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) {
      setError("Please select a film or television title to log.");
      return;
    }

    setSaving(true);
    setError(null);

    const tagsArray = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    try {
      const url = existingEntry?.id ? `/api/diary/${encodeURIComponent(existingEntry.id)}` : "/api/diary";
      const method = existingEntry?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaItemId: selectedMedia.id,
          watchedDate,
          isRewatch,
          ratingValue,
          notes: notes.trim() || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save viewing log");
      }

      onSaved(data.entry || { ...data, mediaItem: selectedMedia });
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong saving your viewing log.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-dialog shadow-dialog overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface/50">
          <div>
            <span className="text-[10px] text-primary uppercase font-bold tracking-widest block">
              Viewing Log
            </span>
            <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
              {existingEntry ? "Edit Viewing Log" : "Log a Viewing"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-button text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Media Selection / Display */}
          {!selectedMedia ? (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Find Film or Episode to Log
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search movie or TV title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-input bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="px-3.5 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Search size={14} />
                  <span>{searching ? "..." : "Search"}</span>
                </button>
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectMedia(item)}
                      className="w-full text-left p-2.5 flex items-center gap-3 hover:bg-card transition-colors cursor-pointer"
                    >
                      <div className="w-8 aspect-[2/3] shrink-0 bg-muted rounded overflow-hidden">
                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {item.title || item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || "Unknown year"} ·{" "}
                          <span className="uppercase">{item.media_type || "Film"}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-card bg-surface border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 aspect-[2/3] shrink-0 rounded overflow-hidden border border-border">
                  <CinematicMediaCard
                    title={selectedMedia.title}
                    posterPath={selectedMedia.posterPath}
                    stillPath={selectedMedia.stillPath}
                    aspect={selectedMedia.mediaType === "tv_episode" ? "video" : "poster"}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {selectedMedia.title}
                  </h3>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedMedia.year && <span>{selectedMedia.year}</span>}
                    {selectedMedia.mediaType && (
                      <span className="ml-1 uppercase text-[9px] tracking-wider">
                        · {selectedMedia.mediaType === "tv_episode" ? "Episode" : "Film"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!existingEntry && (
                <button
                  type="button"
                  onClick={() => setSelectedMedia(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          )}

          {/* Date & Rewatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Viewing Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={watchedDate}
                  onChange={(e) => setWatchedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-input bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-surface border border-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRewatch}
                  onChange={(e) => setIsRewatch(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-medium text-foreground">
                  I&apos;ve watched this before (Rewatch)
                </span>
              </label>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Rating
              </label>
              {ratingValue !== null && (
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  <Star size={13} className="fill-primary" />
                  <span>{ratingValue.toFixed(1)} / 10</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={ratingValue ?? 0}
                onChange={(e) => setRatingValue(parseFloat(e.target.value))}
                className="flex-1 accent-primary cursor-pointer"
              />
              {ratingValue !== null && (
                <button
                  type="button"
                  onClick={() => setRatingValue(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Viewing Notes & Review
            </label>
            <textarea
              rows={3}
              placeholder="What did you think of this viewing? Memorable scenes, commentary..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-input bg-surface border border-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="cinema, 35mm, festival, rewatch-2026"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="w-full px-3 py-2 rounded-input bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-button border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !selectedMedia}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Check size={14} />
            <span>{saving ? "Saving..." : existingEntry ? "Update Viewing" : "Save Viewing Log"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
