"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { BookmarkPlus, Check, Plus, ExternalLink, Loader2, AlertCircle, Layers } from "lucide-react";

interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  collectionType: "tv_show" | "movie_franchise" | "custom";
  tmdbId: number | null;
  entries?: Array<{
    id: string;
    mediaItemId: string;
    mediaItem?: {
      id: string;
      tmdbId?: number | null;
      mediaType?: string | null;
    } | null;
  }>;
}

interface AddToRankingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItemId: string;
  mediaTitle: string;
  mediaType?: "movie" | "episode" | "tv" | "custom";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  parentShowTmdbId?: number | null;
  posterPath?: string | null;
  stillPath?: string | null;
}

export function AddToRankingDialog({
  isOpen,
  onClose,
  mediaItemId,
  mediaTitle,
  mediaType,
  seasonNumber,
  episodeNumber,
  parentShowTmdbId,
  posterPath,
  stillPath,
}: AddToRankingDialogProps) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  // Derive normalized media type if missing
  const effectiveMediaType: "movie" | "episode" | "tv" | "custom" =
    mediaType ||
    (seasonNumber != null && episodeNumber != null
      ? "episode"
      : mediaItemId.startsWith("tv_") && mediaItemId.includes("_s")
        ? "episode"
        : mediaItemId.startsWith("movie_") || mediaItemId.startsWith("tmdb-movie-")
          ? "movie"
          : "custom");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setFetchError(null);
    setActionError(null);

    fetch("/api/collections")
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Please log in to manage your rankings");
          }
          throw new Error("Failed to load your rankings");
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data)) {
          setCollections(data);
          // Pre-populate already added IDs
          const already = new Set<string>();
          for (const col of data) {
            const hasEntry = col.entries?.some(
              (e: any) =>
                e.mediaItemId === mediaItemId ||
                e.mediaItemId === decodeURIComponent(mediaItemId)
            );
            if (hasEntry) {
              already.add(col.id);
            }
          }
          setAddedIds(already);
        }
      })
      .catch((err) => {
        if (isMounted) setFetchError(err.message || "Could not load rankings");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, mediaItemId]);

  const handleAdd = async (col: CollectionSummary) => {
    setAddingId(col.id);
    setActionError(null);

    try {
      const res = await fetch(`/api/collections/${col.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to add to ranking");
      }

      setAddedIds((prev) => new Set([...prev, col.id]));
    } catch (err: any) {
      setActionError({ id: col.id, message: err.message || "Failed to add" });
    } finally {
      setAddingId(null);
    }
  };

  const isEpisode = effectiveMediaType === "episode";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh] overflow-hidden bg-card border border-border-dialog text-foreground p-5 sm:p-6 rounded-dialog shadow-dialog">
        <DialogHeader className="space-y-1.5 shrink-0 pr-8 text-left">
          <DialogTitle className="font-display text-xl uppercase font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookmarkPlus size={20} className="text-primary" />
            <span>Add to Ranking</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Include this title in one of your personal ranking collections. Personal journal scores are never overwritten.
          </DialogDescription>
        </DialogHeader>

        {/* Media Preview Strip */}
        <div className="shrink-0 flex items-center gap-3 p-3 rounded-xl bg-surface border border-border mt-1">
          <div className="shrink-0 w-12 sm:w-14">
            <CinematicMediaCard
              posterPath={posterPath || stillPath}
              title={mediaTitle}
              aspect={isEpisode ? "video" : "poster"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-surface-elevated border border-border text-primary-text">
              {effectiveMediaType === "episode"
                ? seasonNumber != null && episodeNumber != null
                  ? `S${seasonNumber} · E${episodeNumber}`
                  : "Episode"
                : effectiveMediaType === "movie"
                  ? "Film"
                  : "Media"}
            </span>
            <h4 className="font-display text-base uppercase font-bold text-foreground truncate mt-1">
              {mediaTitle}
            </h4>
          </div>
        </div>

        {/* Collections List / State */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-[160px] pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs">Loading your ranking collections...</p>
            </div>
          ) : fetchError ? (
            <div className="py-8 text-center space-y-2 p-4 rounded-xl bg-surface border border-border">
              <AlertCircle size={20} className="text-destructive mx-auto" />
              <p className="text-xs text-destructive font-medium">{fetchError}</p>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-10 text-center space-y-3 p-4 rounded-xl border border-dashed border-border bg-surface/50">
              <Layers size={24} className="text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No ranking collections yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first ranking to start cataloging films and episodes.
                </p>
              </div>
              <Link
                href={`/create?suggest=${encodeURIComponent(mediaTitle)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover transition-colors"
                onClick={onClose}
              >
                <Plus size={14} />
                <span>Create a Ranking</span>
              </Link>
            </div>
          ) : (
            collections.map((col) => {
              const isAdded = addedIds.has(col.id);
              const isAdding = addingId === col.id;
              const hasColError = actionError?.id === col.id ? actionError.message : null;

              // Check type compatibility
              let incompatibilityReason: string | null = null;
              if (col.collectionType === "movie_franchise" && effectiveMediaType !== "movie") {
                incompatibilityReason = "Franchise rankings only accept films";
              } else if (col.collectionType === "tv_show" && effectiveMediaType !== "episode") {
                incompatibilityReason = "TV rankings only accept episodes";
              } else if (
                col.collectionType === "tv_show" &&
                col.tmdbId &&
                parentShowTmdbId &&
                col.tmdbId !== parentShowTmdbId
              ) {
                incompatibilityReason = "Only accepts episodes of its series";
              }

              const typeBadge =
                col.collectionType === "tv_show"
                  ? "TV Series"
                  : col.collectionType === "movie_franchise"
                    ? "Movie Franchise"
                    : "Custom Ranking";

              return (
                <div
                  key={col.id}
                  className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                    isAdded
                      ? "bg-surface-elevated/70 border-primary/30"
                      : incompatibilityReason
                        ? "bg-surface/30 border-border/50 opacity-60"
                        : "bg-surface border-border hover:border-primary/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {typeBadge}
                      </span>
                      {col.entries?.length != null && (
                        <span className="text-[10px] text-muted-foreground/60">
                          · {col.entries.length} items
                        </span>
                      )}
                    </div>
                    <h5 className="font-semibold text-sm text-foreground truncate mt-0.5">
                      {col.title}
                    </h5>

                    {hasColError && (
                      <p className="text-[11px] text-destructive mt-1 font-medium">
                        {hasColError}
                      </p>
                    )}

                    {incompatibilityReason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                        {incompatibilityReason}
                      </p>
                    )}

                    {isAdded && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <span className="text-primary font-semibold flex items-center gap-1 text-[11px]">
                          <Check size={12} /> Added to ranking
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <Link
                          href={`/collection/${col.id}`}
                          className="text-[11px] font-semibold text-primary-text hover:underline inline-flex items-center gap-0.5"
                          onClick={onClose}
                        >
                          <span>Open ranking</span>
                          <ExternalLink size={10} />
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isAdded ? (
                      <Link
                        href={`/collection/${col.id}`}
                        className="px-2.5 py-1.5 rounded-button text-xs font-semibold bg-surface border border-border text-foreground hover:bg-surface-elevated inline-flex items-center gap-1 transition-colors"
                        onClick={onClose}
                      >
                        <ExternalLink size={12} />
                        <span className="hidden sm:inline">View</span>
                      </Link>
                    ) : incompatibilityReason ? (
                      <span className="px-2.5 py-1 rounded-button text-[11px] text-muted-foreground/70 bg-surface/50 border border-border/40 cursor-not-allowed">
                        Incompatible
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdd(col)}
                        disabled={isAdding}
                        className="px-3 py-1.5 rounded-button text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isAdding ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddToRankingButton({
  mediaItemId,
  mediaTitle,
  mediaType,
  seasonNumber,
  episodeNumber,
  parentShowTmdbId,
  posterPath,
  stillPath,
  className,
  variant = "button",
}: {
  mediaItemId: string;
  mediaTitle: string;
  mediaType?: "movie" | "episode" | "tv" | "custom";
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  parentShowTmdbId?: number | null;
  posterPath?: string | null;
  stillPath?: string | null;
  className?: string;
  variant?: "button" | "icon" | "minimal";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Add to Ranking"
          aria-label="Add to Ranking"
          className={
            className ||
            "p-1.5 rounded-button bg-surface border border-border text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
          }
        >
          <BookmarkPlus size={14} />
        </button>
      ) : variant === "minimal" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ||
            "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
          }
        >
          <BookmarkPlus size={13} />
          <span>Add to Ranking</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ||
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button border border-border bg-surface hover:bg-surface-elevated text-foreground font-semibold text-xs transition-colors cursor-pointer"
          }
        >
          <BookmarkPlus size={14} />
          <span>Add to Ranking</span>
        </button>
      )}

      <AddToRankingDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        mediaItemId={mediaItemId}
        mediaTitle={mediaTitle}
        mediaType={mediaType}
        seasonNumber={seasonNumber}
        episodeNumber={episodeNumber}
        parentShowTmdbId={parentShowTmdbId}
        posterPath={posterPath}
        stillPath={stillPath}
      />
    </>
  );
}
