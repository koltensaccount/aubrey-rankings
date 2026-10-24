"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Calendar, List, Plus, Sparkles, Filter, Loader2 } from "lucide-react";
import { TimelineEntryCard } from "./timeline-entry-card";
import { CompactDiaryList } from "./compact-diary-list";
import { LogViewingDialog } from "./log-viewing-dialog";
import { RewatchHistoryModal, type DiaryViewingEvent } from "./rewatch-history-modal";
import { ReviewEditorDialog, type ReviewEditorData } from "@/components/reviews/review-editor-dialog";
import { RatingDialog } from "@/components/rating-dialog";

export type FilterType =
  | "all"
  | "viewings"
  | "reviews"
  | "ratings"
  | "watchlist"
  | "films"
  | "tv"
  | "rewatches";
export type ViewMode = "timeline" | "list";

export interface TimelineEntry extends Partial<DiaryViewingEvent> {
  id: string;
  mediaItemId: string;
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
  eventDate?: string | null;
  eventType?: string;
  badgeLabel?: string;
  diaryEntryId?: string | null;
  reviewId?: string | null;
  ratingId?: string | null;
  watchlistItemId?: string | null;
  ratingValue?: number | null;
  sourceRating?: number | null;
  sourceScale?: number | null;
  reviewContent?: string | null;
  reviewTitle?: string | null;
  reviewVisibility?: string | null;
  reviewIsSpoiler?: boolean;
  tags?: string[] | null;
  createdAt?: Date | string;
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
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  const [dataByFilter, setDataByFilter] = useState<
    Record<
      string,
      {
        entries: TimelineEntry[];
        undated: any[];
        hasMore: boolean;
      }
    >
  >({
    all: {
      entries: initialEntries,
      undated: undatedEntries,
      hasMore:
        hasMoreInitial ||
        (typeof totalDiaryCount === "number" && initialEntries.length < totalDiaryCount),
    },
  });

  const activeData = dataByFilter[filter] || {
    entries: [],
    undated: [],
    hasMore: false,
  };
  const entries = activeData.entries;
  const hasMore = activeData.hasMore;
  const undatedFromFilter = activeData.undated;

  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Dialog state
  const [historyMediaItem, setHistoryMediaItem] = useState<any | null>(null);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logDialogMediaItem, setLogDialogMediaItem] = useState<any | null>(null);

  // Review editing state
  const [editingReview, setEditingReview] = useState<ReviewEditorData | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewDialogMediaItem, setReviewDialogMediaItem] = useState<any | null>(null);

  // Rating editing state
  const [editingRating, setEditingRating] = useState<any | null>(null);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [ratingDialogMediaItem, setRatingDialogMediaItem] = useState<any | null>(null);

  const filterRef = useRef(filter);
  const revisionRef = useRef(0);

  // Synchronize entries cleanly when initialEntries updates
  useEffect(() => {
    const revision = ++revisionRef.current;
    const currentFilter = filterRef.current;
    setDataByFilter({
      all: {
        entries: initialEntries,
        undated: undatedEntries,
        hasMore:
          hasMoreInitial ||
          (typeof totalDiaryCount === "number" && initialEntries.length < totalDiaryCount),
      },
    });
    if (currentFilter !== "all") {
      fetch(`/api/activity?offset=0&limit=50&filter=${encodeURIComponent(currentFilter)}`, { cache: "no-store" })
        .then((res) => { if (!res.ok) throw new Error("Unable to refresh activity"); return res.json(); })
        .then((data) => { if (revision === revisionRef.current) setDataByFilter((prev) => ({ ...prev, [currentFilter]: { entries: data.entries, undated: data.undatedEntries, hasMore: data.hasMore } })); })
        .catch(console.error);
    }
  }, [initialEntries, undatedEntries, hasMoreInitial, totalDiaryCount]);

  // Refetch when switching filters so edits never revive stale categories.
  const handleFilterChange = async (newFilter: FilterType) => {
    setFilter(newFilter);
    filterRef.current = newFilter;
    const revision = revisionRef.current;
    {
      try {
        setLoadingMore(true);
        const res = await fetch(`/api/activity?offset=0&limit=50&filter=${encodeURIComponent(newFilter)}`);
        if (res.ok) {
          const data = await res.json();
          if (revision !== revisionRef.current) return;
          setDataByFilter((prev) => ({
            ...prev,
            [newFilter]: {
              entries: Array.isArray(data.entries) ? data.entries : [],
              undated: Array.isArray(data.undatedEntries) ? data.undatedEntries : [],
              hasMore: Boolean(data.hasMore),
            },
          }));
        }
      } catch (err) {
        console.error("Failed to load filtered activity:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  // Load earlier activities incrementally with consistent combination and filtering
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const revision = revisionRef.current;
    try {
      const res = await fetch(
        `/api/activity?offset=${entries.length}&limit=50&filter=${encodeURIComponent(filter)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (revision !== revisionRef.current) return;
        if (Array.isArray(data.entries)) {
          setDataByFilter((prev) => {
            const current = prev[filter] || { entries: [], undated: [], hasMore: false };
            const existingIds = new Set(current.entries.map((e) => e.id));
            const fresh = data.entries.filter((e: any) => !existingIds.has(e.id));
            return {
              ...prev,
              [filter]: {
                entries: [...current.entries, ...fresh],
                undated: Array.isArray(data.undatedEntries) && data.undatedEntries.length > 0
                  ? data.undatedEntries
                  : current.undated,
                hasMore: Boolean(data.hasMore),
              },
            };
          });
        }
      }
    } catch (err) {
      console.error("Failed to load earlier activities:", err);
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
        e.mediaItem?.mediaType === "episode" ||
        Boolean(e.mediaItem?.seasonNumber && e.mediaItem?.episodeNumber);

      if (filter === "films") {
        return e.mediaItem?.mediaType === "movie" || (!isEpisode && e.mediaItem?.mediaType !== "tv");
      }
      if (filter === "tv") {
        return isEpisode || e.mediaItem?.mediaType === "tv";
      }
      if (filter === "rewatches") {
        const ordinal = e.ordinal ?? mediaOrdinalsMap.get(e.id) ?? 1;
        return Boolean(e.isRewatch || ordinal > 1);
      }
      if (filter === "viewings") {
        return (
          e.eventType === "viewing" ||
          e.eventType === "viewing_and_review" ||
          e.eventType === "watched_mark" ||
          (!e.eventType && (e.watchedDate || e.eventDate))
        );
      }
      if (filter === "reviews") {
        return (
          e.eventType === "review" ||
          e.eventType === "viewing_and_review" ||
          Boolean(e.reviewContent || (e as any).review?.content || (e as any).reviewId)
        );
      }
      if (filter === "ratings") {
        return (
          e.eventType === "rating" ||
          typeof e.ratingValue === "number" ||
          typeof (e as any).sourceRating === "number" ||
          Boolean((e as any).rating)
        );
      }
      if (filter === "watchlist") {
        return e.eventType === "watchlist";
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
      const date = e.eventDate || e.watchedDate;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        dated.push(e);
      } else {
        undated.push(e);
      }
    });

    // Also include genuine undated entries provided by server for active filter
    const seenUndatedIds = new Set(undated.map((u) => u.id));
    if (Array.isArray(undatedFromFilter)) {
      undatedFromFilter.forEach((u) => {
        if (!seenUndatedIds.has(u.id)) {
          undated.push(u);
          seenUndatedIds.add(u.id);
        }
      });
    }

    // Sort dated entries strictly descending by genuine date
    dated.sort((a, b) => {
      const dateA = a.eventDate || a.watchedDate || "";
      const dateB = b.eventDate || b.watchedDate || "";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

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
      const dateStr = entry.eventDate || entry.watchedDate!;
      const dateParts = dateStr.split("-");
      const year = dateParts[0];
      const monthIdx = parseInt(dateParts[1], 10) - 1;
      const monthName = monthNames[monthIdx] || "ACTIVITIES";

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

  const handleEditEntry = async (entry: any, action?: "viewing" | "review" | "rating") => {
    const targetAction =
      action ||
      (entry.eventType === "review"
        ? "review"
        : entry.eventType === "rating"
        ? "rating"
        : "viewing");

    if (targetAction === "review") {
      const reviewId = entry.reviewId;
      if (!reviewId) return;
      try {
        setTimelineError(null);
        const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Unable to load the selected review");
        const data: { review: ReviewEditorData } = await res.json();
        setReviewDialogMediaItem(entry.mediaItem);
        setEditingReview(data.review);
        setIsReviewDialogOpen(true);
      } catch (error) {
        setTimelineError(error instanceof Error ? error.message : "Unable to load review");
      }
      return;
    }

    if (targetAction === "rating") {
      setRatingDialogMediaItem(entry.mediaItem);
      setEditingRating(
        entry.rating || {
          id: entry.ratingId,
          mediaItemId: entry.mediaItemId || entry.mediaItem?.id,
          calculatedOverallScore: entry.ratingValue,
          sourceRating: entry.sourceRating,
          sourceScale: entry.sourceScale,
          watchDate: entry.rating?.watchDate || null,
          isWatched: true,
        }
      );
      setIsRatingDialogOpen(true);
      return;
    }

    // Viewing edit: strictly requires a confirmed diary entry ID
    const viewingId = entry.diaryEntryId;
    if (!viewingId) {
      // Never create a viewing when editing another activity
      return;
    }

    try {
      setTimelineError(null);
      const res = await fetch(`/api/diary/${encodeURIComponent(viewingId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load the selected viewing");
      const data: { entry: NonNullable<Parameters<typeof LogViewingDialog>[0]["existingEntry"]> } = await res.json();
      setEditingEntry(data.entry);
      setLogDialogMediaItem(entry.mediaItem);
      setIsLogDialogOpen(true);
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "Unable to load viewing");
    }
  };

  const reloadTimeline = async () => {
    setTimelineError(null);
    try {
    // Invalidate every cached category, retaining the active filter.
    const revision = ++revisionRef.current;
    setDataByFilter({});
    const res = await fetch(`/api/activity?offset=0&limit=50&filter=${encodeURIComponent(filter)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to refresh timeline");
    const data = await res.json();
    if (revision !== revisionRef.current) return;
    setDataByFilter({ [filter]: { entries: data.entries, undated: data.undatedEntries, hasMore: data.hasMore } });
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : "Unable to refresh timeline");
    }
  };
  const handleRatingSaved = async (saved: unknown) => {
    setIsRatingDialogOpen(false);
    onEntryUpdated?.(saved);
    await reloadTimeline();
  };
  const handleReviewSaved = async (saved: unknown) => {
    setIsReviewDialogOpen(false);
    onEntryUpdated?.(saved);
    await reloadTimeline();
  };
  const handleNewLog = () => {
    setEditingEntry(null);
    setLogDialogMediaItem(null);
    setIsLogDialogOpen(true);
  };
  const handleLogSaved = async (saved: unknown) => {
    if (editingEntry) onEntryUpdated?.(saved);
    else onViewingLogged?.(saved);
    await reloadTimeline();
  };
  const handleEntryDeleted = async (id: string) => {
    onEntryDeleted?.(id);
    await reloadTimeline();
  };

  return (
    <div className="space-y-8">
      {timelineError && <p role="alert" className="text-xs text-destructive">{timelineError}</p>}
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
          <div className="flex flex-wrap items-center gap-1 bg-surface p-0.5 rounded-button border border-border text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "viewings", label: "Viewings" },
                { id: "reviews", label: "Reviews" },
                { id: "ratings", label: "Ratings" },
                { id: "watchlist", label: "Watchlist" },
                { id: "films", label: "Films" },
                { id: "tv", label: "TV" },
                { id: "rewatches", label: "Rewatches" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFilterChange(f.id)}
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
      {entries.length === 0 && undatedFromFilter.length === 0 ? (
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
      ) : filteredEntries.length === 0 && undatedTimelineEntries.length === 0 ? (
        /* Filter Empty State */
        <div className="py-12 text-center text-xs text-muted-foreground">
          No viewings match the &ldquo;{filter}&rdquo; filter.{" "}
          <button
            onClick={() => handleFilterChange("all")}
            className="text-primary hover:underline font-semibold ml-1 cursor-pointer"
          >
            Show all
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* Compact List Mode */
        <CompactDiaryList
          entries={filteredEntries}
          undatedEntries={undatedTimelineEntries}
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
                  Undated Activities ({undatedTimelineEntries.length})
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
            setEditingEntry(null);
            setLogDialogMediaItem(historyMediaItem);
            setIsLogDialogOpen(true);
          }}
          onEditEntry={(entry) => {
            setHistoryMediaItem(null);
            handleEditEntry({ ...entry, diaryEntryId: entry.id });
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

      {/* First-Class Review Editor Dialog */}
      {isReviewDialogOpen && reviewDialogMediaItem && (
        <ReviewEditorDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          mediaItemId={reviewDialogMediaItem.id}
          mediaTitle={reviewDialogMediaItem.title}
          posterPath={reviewDialogMediaItem.posterPath}
          existingReview={editingReview}
          onSaved={handleReviewSaved}
          onDeleted={(deletedId) => {
            handleEntryDeleted(deletedId);
            setIsReviewDialogOpen(false);
          }}
        />
      )}

      {/* Rating Editor Dialog */}
      {isRatingDialogOpen && ratingDialogMediaItem && (
        <RatingDialog
          isOpen={isRatingDialogOpen}
          onClose={() => setIsRatingDialogOpen(false)}
          mediaItem={ratingDialogMediaItem}
          ratingSystem={null}
          initialRating={editingRating}
          onRatingSaved={handleRatingSaved}
        />
      )}
    </div>
  );
}
