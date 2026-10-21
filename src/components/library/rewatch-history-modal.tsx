"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Star, Trash2, Edit2, Plus, History } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";

export interface DiaryViewingEvent {
  id: string;
  mediaItemId: string;
  watchedDate?: string | null;
  loggedDate?: string | Date | null;
  isRewatch: boolean;
  ratingValue?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  rating?: {
    id: string;
    calculatedOverallScore?: number | null;
    sourceRating?: number | null;
    sourceScale?: number | null;
    sourceService?: string | null;
    ratingSystem?: { scale: number; type: string } | null;
    categoryScores?: readonly unknown[];
  } | null;
  review?: {
    id: string;
    content?: string | null;
    draftContent?: string | null;
    status: string;
    visibility: string;
    isSpoiler: boolean;
  } | null;
}

interface RewatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  initialEntries?: DiaryViewingEvent[];
  onLogNewViewing: (mediaItem: any) => void;
  onEditEntry?: (entry: DiaryViewingEvent) => void;
  onEntryDeleted?: (entryId: string) => void;
}

function getEventScoreOnTen(event: DiaryViewingEvent): number | null {
  if (typeof event.ratingValue === "number" && Number.isFinite(event.ratingValue)) {
    return event.ratingValue;
  }
  if (event.rating) {
    const r = event.rating as any;
    if (typeof r.calculatedOverallScore === "number" && Number.isFinite(r.calculatedOverallScore)) {
      const scale = r.ratingSystem?.scale || 10;
      return (r.calculatedOverallScore / scale) * 10;
    }
    if (typeof r.sourceRating === "number" && Number.isFinite(r.sourceRating)) {
      const scale = typeof r.sourceScale === "number" && r.sourceScale > 0 ? r.sourceScale : 10;
      return (r.sourceRating / scale) * 10;
    }
  }
  return null;
}

export function RewatchHistoryModal({
  isOpen,
  onClose,
  mediaItem,
  initialEntries,
  onLogNewViewing,
  onEditEntry,
  onEntryDeleted,
}: RewatchHistoryModalProps) {
  const [entries, setEntries] = useState<DiaryViewingEvent[]>(initialEntries || []);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialEntries && initialEntries.length > 0) {
      setEntries(initialEntries);
      return;
    }
    // Fetch all entries for this media item
    setLoading(true);
    fetch(`/api/diary?mediaItemId=${encodeURIComponent(mediaItem.id)}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.entries)) {
          setEntries(data.entries);
        }
      })
      .catch((err) => console.error("Failed to load viewing history:", err))
      .finally(() => setLoading(false));
  }, [isOpen, mediaItem.id, initialEntries]);

  if (!isOpen) return null;

  const isEpisode =
    mediaItem.mediaType === "episode" ||
    Boolean(mediaItem.seasonNumber && mediaItem.episodeNumber);

  // Sort chronologically ascending to compute ordinals and chart
  const sortedAscending = [...entries].sort((a, b) => {
    const dateA = a.watchedDate || "";
    const dateB = b.watchedDate || "";
    return dateA.localeCompare(dateB);
  });

  // Extract ratings for score evolution graphic
  const ratedEvents = sortedAscending
    .map((e) => ({ ...e, normalizedScore: getEventScoreOnTen(e) }))
    .filter((e) => typeof e.normalizedScore === "number");

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this viewing log?")) return;
    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/diary?id=${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        if (onEntryDeleted) onEntryDeleted(entryId);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-dialog shadow-dialog overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-surface/50">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`shrink-0 ${isEpisode ? "w-20 aspect-video" : "w-14 sm:w-16 aspect-[2/3]"}`}>
              <CinematicMediaCard
                title={mediaItem.title}
                posterPath={isEpisode ? mediaItem.stillPath || mediaItem.posterPath : mediaItem.posterPath}
                stillPath={mediaItem.stillPath}
                aspect={isEpisode ? "video" : "poster"}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
                <History size={13} />
                <span>Rewatch History</span>
                <span className="text-muted-foreground/60">·</span>
                <span>
                  {entries.length} {entries.length === 1 ? "Logged Viewing" : "Logged Viewings"}
                </span>
              </div>
              <h2
                id="history-modal-title"
                className="font-display text-2xl sm:text-3xl uppercase tracking-tight text-foreground truncate mt-0.5"
              >
                {mediaItem.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {mediaItem.year && <span>{mediaItem.year}</span>}
                {mediaItem.mediaType && (
                  <>
                    <span>·</span>
                    <span className="uppercase text-[10px] tracking-wide font-bold text-primary">
                      {isEpisode
                        ? mediaItem.seasonNumber && mediaItem.episodeNumber
                          ? `S${mediaItem.seasonNumber} · E${mediaItem.episodeNumber}`
                          : "Episode"
                        : mediaItem.mediaType === "tv"
                        ? "TV Series"
                        : "Film"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-button text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Rating Evolution Graphic (When >= 2 ratings exist) */}
          {ratedEvents.length >= 2 && (
            <div className="p-4 rounded-card bg-surface border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Rating Evolution Over Time
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {ratedEvents.length} rated viewings
                </span>
              </div>

              {/* Accessible SVG line chart */}
              <div className="w-full h-24 pt-2">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${Math.max(260, ratedEvents.length * 80)} 70`}
                  preserveAspectRatio="none"
                  aria-label="Rating trend chart"
                  role="img"
                >
                  {/* Grid lines for 5 and 10 */}
                  <line
                    x1="20"
                    y1="10"
                    x2={Math.max(240, ratedEvents.length * 80 - 20)}
                    y2="10"
                    stroke="currentColor"
                    strokeDasharray="2 3"
                    className="text-border"
                    strokeWidth="1"
                  />
                  <line
                    x1="20"
                    y1="50"
                    x2={Math.max(240, ratedEvents.length * 80 - 20)}
                    y2="50"
                    stroke="currentColor"
                    strokeDasharray="2 3"
                    className="text-border"
                    strokeWidth="1"
                  />

                  {/* Connect points with a polyline */}
                  {(() => {
                    const width = Math.max(260, ratedEvents.length * 80);
                    const padding = 30;
                    const step =
                      ratedEvents.length > 1
                        ? (width - padding * 2) / (ratedEvents.length - 1)
                        : 0;

                    const points = ratedEvents
                      .map((evt, idx) => {
                        const score = Math.min(10, Math.max(0, evt.normalizedScore || 0));
                        // 10 -> y:10, 0 -> y:60
                        const y = 60 - (score / 10) * 50;
                        const x = padding + idx * step;
                        return `${x},${y}`;
                      })
                      .join(" ");

                    return (
                      <polyline
                        fill="none"
                        stroke="var(--color-primary, #0d9488)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                    );
                  })()}

                  {/* Data Points */}
                  {ratedEvents.map((evt, idx) => {
                    const width = Math.max(260, ratedEvents.length * 80);
                    const padding = 30;
                    const step =
                      ratedEvents.length > 1
                        ? (width - padding * 2) / (ratedEvents.length - 1)
                        : 0;
                    const score = Math.min(10, Math.max(0, evt.normalizedScore || 0));
                    const y = 60 - (score / 10) * 50;
                    const x = padding + idx * step;

                    return (
                      <g key={evt.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill="var(--color-primary, #0d9488)"
                          stroke="var(--color-card, #121212)"
                          strokeWidth="2"
                        />
                        <text
                          x={x}
                          y={y - 8}
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-[10px] font-bold fill-foreground"
                        >
                          {score.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* Chronological viewing list (ordered from newest to oldest for reading comfort) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              All Logged Viewings
            </h3>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading viewing history...
              </div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No viewing records logged for this title yet.
              </div>
            ) : (
              <div className="space-y-3">
                {[...sortedAscending].reverse().map((entry) => {
                  const ascIndex = sortedAscending.findIndex((e) => e.id === entry.id);
                  const viewingNumber = ascIndex + 1;
                  const isRewatch = Boolean(entry.isRewatch || viewingNumber > 1);

                  const ordinalSuffix =
                    viewingNumber === 1
                      ? "1st"
                      : viewingNumber === 2
                      ? "2nd"
                      : viewingNumber === 3
                      ? "3rd"
                      : `${viewingNumber}th`;

                  let badgeLabel = "1st logged viewing";
                  if (isRewatch) {
                    if (entries.length > 1 && viewingNumber > 1) {
                      badgeLabel = `Rewatch · ${ordinalSuffix} logged viewing`;
                    } else {
                      badgeLabel = "Rewatch";
                    }
                  }

                  const formattedDate = entry.watchedDate
                    ? new Date(`${entry.watchedDate}T12:00:00Z`).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Undated";

                  const scoreOnTen = getEventScoreOnTen(entry);

                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-card bg-surface border border-border flex items-start justify-between gap-4 transition-colors hover:border-primary/30"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isRewatch
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {badgeLabel}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formattedDate}</span>
                          </span>
                          {scoreOnTen !== null && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              <Star size={12} className="fill-primary" />
                              <span>{scoreOnTen.toFixed(1)} / 10</span>
                            </span>
                          )}
                        </div>

                        {/* Notes or review excerpt */}
                        {(entry.notes || entry.review?.content) && (
                          <div className="text-xs text-foreground/90 mt-1 italic">
                            <SpoilerConcealedText
                              content={entry.notes || entry.review?.content}
                              isSpoiler={entry.review?.isSpoiler}
                              quoteStyle
                            />
                          </div>
                        )}

                        {/* Tags */}
                        {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {entry.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded text-[9px] bg-card border border-border text-muted-foreground"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Item Actions: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(entry)}
                            className="p-1.5 rounded-button text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                            title="Edit viewing log"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="p-1.5 rounded-button text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete viewing log"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-button border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogNewViewing(mediaItem);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Log Another Viewing</span>
          </button>
        </div>
      </div>
    </div>
  );
}
