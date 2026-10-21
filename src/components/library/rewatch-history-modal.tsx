"use client";

import { useEffect, useState } from "react";
import { X, Calendar, Star, History, Plus, Film, Tv, Trash2, Edit2 } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { reviewScoreOnTen } from "@/lib/review-rating";

export interface DiaryViewingEvent {
  id: string;
  userId: string;
  mediaItemId: string;
  watchedDate: string | null;
  loggedDate: string | Date | null;
  isRewatch: boolean;
  ratingValue: number | null;
  notes: string | null;
  tags?: string[] | null;
  reviewId?: string | null;
  ratingId?: string | null;
  review?: {
    id: string;
    content: string;
    isSpoiler: boolean;
    visibility: string;
    status: string;
  } | null;
  rating?: {
    id: string;
    calculatedOverallScore?: number | null;
    sourceRating?: number | null;
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
    posterPath?: string | null;
    stillPath?: string | null;
  };
  initialEntries?: DiaryViewingEvent[];
  onLogNewViewing?: () => void;
  onEditEntry?: (entry: DiaryViewingEvent) => void;
  onEntryDeleted?: (id: string) => void;
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

  // Sort chronologically ascending to compute ordinals and chart
  const sortedAscending = [...entries].sort((a, b) => {
    const dateA = a.watchedDate || (a.loggedDate ? new Date(a.loggedDate).toISOString().slice(0, 10) : "");
    const dateB = b.watchedDate || (b.loggedDate ? new Date(b.loggedDate).toISOString().slice(0, 10) : "");
    return dateA.localeCompare(dateB);
  });

  // Extract ratings for score evolution graphic
  const ratedEvents = sortedAscending.filter(
    (e) => typeof e.ratingValue === "number" && !isNaN(e.ratingValue)
  );

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-dialog shadow-dialog overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-surface/50">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 sm:w-16 shrink-0">
              <CinematicMediaCard
                title={mediaItem.title}
                posterPath={mediaItem.posterPath}
                stillPath={mediaItem.stillPath}
                aspect={mediaItem.mediaType === "tv_episode" ? "video" : "poster"}
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
                    <span className="uppercase text-[10px] tracking-wide">
                      {mediaItem.mediaType === "tv_episode" ? "Episode" : "Film"}
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
                    const step = (width - 60) / Math.max(1, ratedEvents.length - 1);
                    const points = ratedEvents.map((evt, idx) => {
                      const x = 30 + idx * step;
                      // 0 score => y = 55; 10 score => y = 10
                      const score = Math.min(10, Math.max(0, evt.ratingValue || 0));
                      const y = 55 - (score / 10) * 45;
                      return { x, y, score, date: evt.watchedDate };
                    });

                    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-primary"
                          points={polylinePoints}
                        />
                        {points.map((pt, i) => (
                          <g key={i}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="4.5"
                              className="fill-background stroke-primary stroke-[2.5]"
                            />
                            <text
                              x={pt.x}
                              y={Math.max(8, pt.y - 7)}
                              textAnchor="middle"
                              className="text-[10px] font-bold fill-foreground"
                            >
                              {pt.score.toFixed(1)}
                            </text>
                            {pt.date && (
                              <text
                                x={pt.x}
                                y="66"
                                textAnchor="middle"
                                className="text-[9px] fill-muted-foreground"
                              >
                                {pt.date.slice(5)}
                              </text>
                            )}
                          </g>
                        ))}
                      </>
                    );
                  })()}
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
                {/* Map sorted entries descending for display, but calculating ordinals from ascending order */}
                {[...sortedAscending].reverse().map((entry) => {
                  const ascIndex = sortedAscending.findIndex((e) => e.id === entry.id);
                  const viewingNumber = ascIndex + 1;
                  const isRewatch = entry.isRewatch || viewingNumber > 1;

                  const ordinalSuffix =
                    viewingNumber === 1
                      ? "1st"
                      : viewingNumber === 2
                      ? "2nd"
                      : viewingNumber === 3
                      ? "3rd"
                      : `${viewingNumber}th`;

                  const formattedDate = entry.watchedDate
                    ? new Date(`${entry.watchedDate}T12:00:00Z`).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : entry.loggedDate
                    ? new Date(entry.loggedDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Undated";

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
                            {isRewatch ? `Rewatch · ${ordinalSuffix} logged viewing` : "1st logged viewing"}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formattedDate}</span>
                          </span>
                          {entry.ratingValue !== null && entry.ratingValue !== undefined && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              <Star size={12} className="fill-primary" />
                              <span>{entry.ratingValue.toFixed(1)} / 10</span>
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
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {entry.tags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-card text-muted-foreground border border-border"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onEditEntry && (
                          <button
                            type="button"
                            onClick={() => onEditEntry(entry)}
                            className="p-1.5 rounded-button text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                            title="Edit this viewing log"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="p-1.5 rounded-button text-muted-foreground hover:text-destructive hover:bg-card transition-colors cursor-pointer"
                          title="Delete this viewing log"
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

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-button border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Close
          </button>
          {onLogNewViewing && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogNewViewing();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            >
              <Plus size={14} />
              <span>Log another viewing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
