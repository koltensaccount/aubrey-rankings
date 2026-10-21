"use client";

import { useMemo, useState } from "react";
import { Film, Tv, History, Filter, List, Calendar, Plus, Sparkles } from "lucide-react";
import { TimelineEntryCard } from "./timeline-entry-card";
import { CompactDiaryList } from "./compact-diary-list";
import { RewatchHistoryModal, type DiaryViewingEvent } from "./rewatch-history-modal";
import { LogViewingDialog } from "./log-viewing-dialog";

export interface TimelineEntry extends DiaryViewingEvent {
  mediaItem: {
    id: string;
    title: string;
    year?: number | null;
    releaseDate?: string | null;
    mediaType?: string | null;
    posterPath?: string | null;
    stillPath?: string | null;
  };
}

interface CinematicTimelineProps {
  entries: TimelineEntry[];
  undatedEntries?: Array<{
    id: string;
    mediaItem: {
      id: string;
      title: string;
      year?: number | null;
      mediaType?: string | null;
      posterPath?: string | null;
      stillPath?: string | null;
    };
    ratingValue?: number | null;
    status?: string;
    content?: string;
  }>;
  onEntrySaved?: (entry: any) => void;
  onEntryDeleted?: (id: string) => void;
}

type FilterType = "all" | "films" | "tv" | "rewatches";
type ViewMode = "timeline" | "list";

export function CinematicTimeline({
  entries: initialEntries,
  undatedEntries = [],
  onEntrySaved,
  onEntryDeleted,
}: CinematicTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries);
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  // Dialog state
  const [historyMediaItem, setHistoryMediaItem] = useState<any | null>(null);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logDialogMediaItem, setLogDialogMediaItem] = useState<any | null>(null);

  // Synchronize entries if initialEntries changes
  useMemo(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Compute total viewings and chronological ordinals per media item
  const { mediaOrdinalsMap, mediaTotalCountMap } = useMemo(() => {
    const ordinalsMap = new Map<string, number>(); // entry.id -> ordinal (1, 2, 3...)
    const totalCountMap = new Map<string, number>(); // mediaItemId -> total count

    // Group all entries by mediaItemId
    const byMedia = new Map<string, TimelineEntry[]>();
    entries.forEach((e) => {
      const list = byMedia.get(e.mediaItemId) || [];
      list.push(e);
      byMedia.set(e.mediaItemId, list);
    });

    // For each media item, sort chronologically ascending to assign 1st, 2nd, 3rd viewing
    byMedia.forEach((mediaEntries, mediaId) => {
      totalCountMap.set(mediaId, mediaEntries.length);

      const sortedAsc = [...mediaEntries].sort((a, b) => {
        const dateA = a.watchedDate || (a.loggedDate ? new Date(a.loggedDate).toISOString().slice(0, 10) : "");
        const dateB = b.watchedDate || (b.loggedDate ? new Date(b.loggedDate).toISOString().slice(0, 10) : "");
        return dateA.localeCompare(dateB);
      });

      sortedAsc.forEach((entry, idx) => {
        ordinalsMap.set(entry.id, idx + 1);
      });
    });

    return { mediaOrdinalsMap: ordinalsMap, mediaTotalCountMap: totalCountMap };
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter === "films") {
        return e.mediaItem.mediaType !== "tv_episode" && e.mediaItem.mediaType !== "tv_show";
      }
      if (filter === "tv") {
        return e.mediaItem.mediaType === "tv_episode" || e.mediaItem.mediaType === "tv_show";
      }
      if (filter === "rewatches") {
        const ordinal = mediaOrdinalsMap.get(e.id) || 1;
        return e.isRewatch || ordinal > 1;
      }
      return true;
    });
  }, [entries, filter, mediaOrdinalsMap]);

  // Group filtered entries chronologically by Year, then Month
  const groupedChronology = useMemo(() => {
    // Sort descending by genuine viewing date (never DB modification timestamps)
    const sorted = [...filteredEntries].sort((a, b) => {
      const dateA = a.watchedDate || (a.loggedDate ? new Date(a.loggedDate).toISOString().slice(0, 10) : "0000-00-00");
      const dateB = b.watchedDate || (b.loggedDate ? new Date(b.loggedDate).toISOString().slice(0, 10) : "0000-00-00");
      return dateB.localeCompare(dateA);
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

    sorted.forEach((entry) => {
      let year = "UNKNOWN YEAR";
      let monthIndex = -1;

      if (entry.watchedDate) {
        const parts = entry.watchedDate.split("-");
        if (parts.length >= 2) {
          year = parts[0];
          monthIndex = parseInt(parts[1], 10) - 1;
        }
      } else if (entry.loggedDate) {
        const d = new Date(entry.loggedDate);
        year = String(d.getFullYear());
        monthIndex = d.getMonth();
      }

      const monthName = monthNames[monthIndex] || "OTHER";

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

    return groups;
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

  const handleLogSaved = (saved: any) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    if (onEntrySaved) onEntrySaved(saved);
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
                  ? "bg-primary text-primary-foreground shadow-sm"
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
                  ? "bg-primary text-primary-foreground shadow-sm"
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
                    ? "bg-card text-foreground shadow-sm border border-border"
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors cursor-pointer shadow-sm"
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
        <div className="max-w-3xl mx-auto">
          {groupedChronology.map((yearGroup) => (
            <div key={yearGroup.year} className="mb-12 last:mb-0">
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
                        const ordinal = mediaOrdinalsMap.get(entry.id) || 1;
                        const totalLogs = mediaTotalCountMap.get(entry.mediaItemId) || 1;

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
