"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, List, Plus, Sparkles, Filter, Loader2 } from "lucide-react";
import { TimelineEntryCard } from "./timeline-entry-card";
import { CompactDiaryList } from "./compact-diary-list";
import { LogViewingDialog } from "./log-viewing-dialog";
import { RewatchHistoryModal, type DiaryViewingEvent } from "./rewatch-history-modal";

export type FilterType = "all" | "films" | "tv" | "rewatches";
export type ViewMode = "timeline" | "list";

export interface TimelineEntry extends DiaryViewingEvent {
  mediaItem: {
    id: string;
    title: string;
    year?: number | null;
    releaseDate?: string | null;
    mediaType?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    posterPath?: string | null;
    stillPath?: string | null;
  };
}

interface CinematicTimelineProps {
  initialEntries: TimelineEntry[];
  totalDiaryCount?: number;
  hasMoreInitial?: boolean;
  undatedEntries?: Array<{
    id: string;
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
    ratingValue?: number | null;
    status?: string;
    content?: string;
  }>;
  onViewingLogged?: (entry: any) => void;
  onEntryUpdated?: (entry: any) => void;
  onEntryDeleted?: (entryId: string) => void;
}

export function CinematicTimeline({
  initialEntries,
  totalDiaryCount,
  hasMoreInitial = false,
  undatedEntries = [],
  onViewingLogged,
  onEntryUpdated,
  onEntryDeleted,
}: CinematicTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries);
  const [hasMore, setHasMore] = useState<boolean>(
    hasMoreInitial || (typeof totalDiaryCount === "number" && initialEntries.length < totalDiaryCount)
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  // Dialog state
  const [historyMediaItem, setHistoryMediaItem] = useState<any | null>(null);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logDialogMediaItem, setLogDialogMediaItem] = useState<any | null>(null);

  // Synchronize entries cleanly when initialEntries updates
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Load earlier viewings incrementally
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/diary?offset=${entries.length}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          setEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const fresh = data.entries.filter((e: any) => !existingIds.has(e.id));
            return [...prev, ...fresh];
          });
          setHasMore(Boolean(data.hasMore));
        }
      }
    } catch (err) {
      console.error("Failed to load earlier viewings:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Compute total viewings and chronological ordinals per media item
  // Ordinals strictly reflect known logged events in ascending order across lifetime history
  const { mediaOrdinalsMap, mediaTotalCountMap } = useMemo(() => {
    const ordinalsMap = new Map<string, number>(); // entry.id -> ordinal (1, 2, 3...)
    const totalCountMap = new Map<string, number>(); // mediaItemId -> total count

    // 1. Populate from entry-level metadata if provided by the server/database
    entries.forEach((e) => {
      if (typeof e.ordinal === "number") {
        ordinalsMap.set(e.id, e.ordinal);
      }
      if (typeof e.totalViewings === "number") {
        const cur = totalCountMap.get(e.mediaItemId) || 0;
        totalCountMap.set(e.mediaItemId, Math.max(cur, e.totalViewings));
      }
    });

    // 2. For any entries without server ordinals, compute locally
    const byMedia = new Map<string, TimelineEntry[]>();
    entries.forEach((e) => {
      const list = byMedia.get(e.mediaItemId) || [];
      list.push(e);
      byMedia.set(e.mediaItemId, list);
    });

    // For each media item, sort chronologically ascending to assign ordinals if missing
    byMedia.forEach((mediaEntries, mediaId) => {
      if (!totalCountMap.has(mediaId)) {
        totalCountMap.set(mediaId, mediaEntries.length);
      }

      const sortedAsc = [...mediaEntries].sort((a, b) => {
        const dateA = a.watchedDate || "";
        const dateB = b.watchedDate || "";
        return dateA.localeCompare(dateB);
      });

      sortedAsc.forEach((entry, idx) => {
        if (!ordinalsMap.has(entry.id)) {
          ordinalsMap.set(entry.id, idx + 1);
        }
      });
    });

    return { mediaOrdinalsMap: ordinalsMap, mediaTotalCountMap: totalCountMap };
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const isEpisode =
        e.mediaItem.mediaType === "episode" ||
        Boolean(e.mediaItem.seasonNumber && e.mediaItem.episodeNumber);

      if (filter === "films") {
        return e.mediaItem.mediaType === "movie" || (!isEpisode && e.mediaItem.mediaType !== "tv");
      }
      if (filter === "tv") {
        return isEpisode || e.mediaItem.mediaType === "tv";
      }
      if (filter === "rewatches") {
        const ordinal = e.ordinal ?? mediaOrdinalsMap.get(e.id) ?? 1;
        return Boolean(e.isRewatch || ordinal > 1);
      }
      return true;
    });
  }, [entries, filter, mediaOrdinalsMap]);

  // Partition confirmed dated entries from undated entries
  // NEVER fabricate a viewing date from a database modification or activity timestamp
  const { groupedChronology, undatedTimelineEntries } = useMemo(() => {
    const dated: TimelineEntry[] = [];
    const undated: TimelineEntry[] = [];

    filteredEntries.forEach((e) => {
      if (e.watchedDate && /^\d{4}-\d{2}-\d{2}$/.test(e.watchedDate.trim())) {
        dated.push(e);
      } else {
        undated.push(e);
      }
    });

    // Sort dated entries strictly descending by genuine viewing date
    dated.sort((a, b) => (b.watchedDate || "").localeCompare(a.watchedDate || ""));

    // Map: Year -> MonthName -> entries[]
    const groups: Array<{
      year: string;
      months: Array<{
        monthName: string;
        entries: TimelineEntry[];
      }>;
    }> = [];

    const monthNames = [
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
    ];

    dated.forEach((entry) => {
      const dateParts = entry.watchedDate!.split("-");
      const year = dateParts[0];
      const monthIdx = parseInt(dateParts[1], 10) - 1;
      const monthName = monthNames[monthIdx] || "VIEWINGS";

      let yearGroup = groups.find((g) => g.year === year);
      if (!yearGroup) {
        yearGroup = { year, months: [] };
        groups.push(yearGroup);
      }

      let monthGroup = yearGroup.months.find((m) => m.monthName === monthName);
      if (!monthGroup) {
        monthGroup = { monthName, entries: [] };
        yearGroup.months.push(monthGroup);
      }

      monthGroup.entries.push(entry);
    });

    return { groupedChronology: groups, undatedTimelineEntries: undated };
  }, [filteredEntries]);

  const handleOpenHistory = (mediaItem: any) => {
    setHistoryMediaItem(mediaItem);
  };

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setLogDialogMediaItem(entry.mediaItem);
    setIsLogDialogOpen(true);
  };

  const handleNewLog = () => {
    setEditingEntry(null);
    setLogDialogMediaItem(null);
    setIsLogDialogOpen(true);
  };

  const handleLogSaved = (savedEntry: any) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === savedEntry.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...savedEntry };
        return copy;
      }
      return [savedEntry, ...prev];
    });

    if (editingEntry) {
      if (onEntryUpdated) onEntryUpdated(savedEntry);
    } else {
      if (onViewingLogged) onViewingLogged(savedEntry);
    }
  };

  const handleEntryDeleted = (deletedId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== deletedId));
    if (onEntryDeleted) onEntryDeleted(deletedId);
  };

  return (
    <div className="space-y-8">
      {/* Journal Controls Bar: View Switcher, Filter Chips, Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        {/* Left: Section Subheading & Supporting Copy */}
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Your Viewing History
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every viewing has a story.
          </p>
        </div>

        {/* Right: Controls Strip */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-button p-0.5 bg-surface border border-border select-none">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar size={13} />
              <span>Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-button text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={13} />
              <span>List</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-surface p-0.5 rounded-button border border-border text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "films", label: "Films" },
                { id: "tv", label: "Episodes" },
                { id: "rewatches", label: "Rewatches" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  filter === f.id
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Add to Journal Action */}
          <button
            type="button"
            onClick={handleNewLog}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Add Viewing</span>
          </button>
        </div>
      </div>

      {/* Main Content Presentation */}
      {entries.length === 0 ? (
        /* Empty State */
        <div className="py-20 text-center rounded-2xl border border-dashed border-border bg-card/50 p-8 sm:p-12 space-y-4 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
            <Sparkles size={22} />
          </div>
          <h3 className="font-display text-3xl uppercase tracking-tight text-foreground">
            Your Story Starts With Your First Log
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every film you watch can become part of your personal history. Track watch dates, ratings, and rewatches in your cinematic archive.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleNewLog}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer shadow-md"
            >
              <Plus size={15} />
              <span>Log Your First Viewing</span>
            </button>
          </div>
        </div>
      ) : filteredEntries.length === 0 ? (
        /* Filter Empty State */
        <div className="py-12 text-center text-xs text-muted-foreground">
          No viewings match the &ldquo;{filter}&rdquo; filter.{" "}
          <button
            onClick={() => setFilter("all")}
            className="text-primary hover:underline font-semibold ml-1 cursor-pointer"
          >
            Show all
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* Compact List Mode */
        <CompactDiaryList
          entries={filteredEntries}
          undatedEntries={undatedEntries}
          onOpenHistory={handleOpenHistory}
          onEditEntry={handleEditEntry}
        />
      ) : (
        /* Signature Cinematic Viewing Timeline */
        <div className="max-w-3xl mx-auto space-y-12">
          {groupedChronology.map((yearGroup) => (
            <div key={yearGroup.year} className="last:mb-0">
              {/* Year Heading (Large Barlow Condensed) */}
              <div className="flex items-center gap-4 mb-6 select-none">
                <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground uppercase">
                  {yearGroup.year}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {yearGroup.months.map((monthGroup) => (
                <div key={monthGroup.monthName} className="mb-8 last:mb-0">
                  {/* Subtle Month Divider */}
                  <div className="flex items-center gap-3 mb-4 select-none pl-1 sm:pl-2">
                    <span className="text-[11px] font-bold tracking-widest text-primary uppercase">
                      {monthGroup.monthName}
                    </span>
                    <div className="w-12 h-px bg-primary/20" />
                  </div>

                  {/* Vertical Timeline Reading Column with Continuous Connecting Line */}
                  <div className="relative">
                    {/* The continuous vertical connecting line (2px, semantic border color) */}
                    <div
                      className="absolute top-4 bottom-4 left-[54px] sm:left-[70px] w-0.5 bg-border pointer-events-none"
                      aria-hidden="true"
                    />

                    {/* Timeline Entries */}
                    <div className="space-y-1">
                      {monthGroup.entries.map((entry) => {
                        const ordinal = entry.ordinal ?? mediaOrdinalsMap.get(entry.id) ?? 1;
                        const totalLogs = entry.totalViewings ?? mediaTotalCountMap.get(entry.mediaItemId) ?? 1;

                        return (
                          <TimelineEntryCard
                            key={entry.id}
                            entry={entry}
                            ordinalIndex={ordinal}
                            totalViewingsForMedia={totalLogs}
                            onOpenHistory={handleOpenHistory}
                            onEditEntry={handleEditEntry}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Undated viewing entries (distinct from confirmed dates) */}
          {undatedTimelineEntries.length > 0 && (
            <div className="pt-6 border-t border-border/80">
              <div className="flex items-center gap-4 mb-4 select-none">
                <span className="font-display text-2xl font-bold tracking-tight text-muted-foreground uppercase">
                  Undated Viewings ({undatedTimelineEntries.length})
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="space-y-2">
                {undatedTimelineEntries.map((entry) => {
                  const ordinal = entry.ordinal ?? mediaOrdinalsMap.get(entry.id) ?? 1;
                  const totalLogs = entry.totalViewings ?? mediaTotalCountMap.get(entry.mediaItemId) ?? 1;
                  return (
                    <TimelineEntryCard
                      key={entry.id}
                      entry={entry}
                      ordinalIndex={ordinal}
                      totalViewingsForMedia={totalLogs}
                      onOpenHistory={handleOpenHistory}
                      onEditEntry={handleEditEntry}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Incremental Loading Trigger */}
          {hasMore && (
            <div className="pt-6 pb-2 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-surface hover:bg-surface-elevated border border-border text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span>Loading earlier viewings...</span>
                  </>
                ) : (
                  <span>Load earlier viewings</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rewatch History Modal */}
      {historyMediaItem && (
        <RewatchHistoryModal
          isOpen={Boolean(historyMediaItem)}
          onClose={() => setHistoryMediaItem(null)}
          mediaItem={historyMediaItem}
          onLogNewViewing={() => {
            setLogDialogMediaItem(historyMediaItem);
            setIsLogDialogOpen(true);
          }}
          onEditEntry={(entry) => {
            setHistoryMediaItem(null);
            handleEditEntry(entry);
          }}
          onEntryDeleted={(id) => {
            handleEntryDeleted(id);
          }}
        />
      )}

      {/* Log/Edit Viewing Dialog */}
      {isLogDialogOpen && (
        <LogViewingDialog
          isOpen={isLogDialogOpen}
          onClose={() => setIsLogDialogOpen(false)}
          mediaItem={logDialogMediaItem}
          existingEntry={editingEntry}
          onSaved={handleLogSaved}
        />
      )}
    </div>
  );
}
