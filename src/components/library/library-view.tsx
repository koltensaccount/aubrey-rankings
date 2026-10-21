"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, CheckCircle2, Bookmark, ListFilter, Plus, PenLine } from "lucide-react";
import { CinematicTimeline, type TimelineEntry } from "./cinematic-timeline";
import { WatchedGrid, type WatchedItem } from "./watched-grid";
import { WatchlistGrid, type WatchlistGridItem } from "./watchlist-grid";
import { RankingsSection } from "./rankings-section";
import { LogViewingDialog } from "./log-viewing-dialog";

export type LibraryTab = "journal" | "watched" | "watchlist" | "rankings";

interface LibraryViewProps {
  initialTab?: LibraryTab;
  diaryEntries: TimelineEntry[];
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
  watchedItems: WatchedItem[];
  watchlistItems: WatchlistGridItem[];
  collections: any[];
  savedCollections?: any[];
  totalRatedCount: number;
  meanScore: string;
}

export function LibraryView({
  initialTab = "journal",
  diaryEntries,
  undatedEntries = [],
  watchedItems,
  watchlistItems,
  collections,
  savedCollections = [],
  totalRatedCount,
  meanScore,
}: LibraryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get("tab")?.toLowerCase() as LibraryTab | undefined;
  const validTabs: LibraryTab[] = ["journal", "watched", "watchlist", "rankings"];
  const currentTab: LibraryTab = validTabs.includes(tabParam as any)
    ? (tabParam as LibraryTab)
    : validTabs.includes(initialTab)
    ? initialTab
    : "journal";

  const [activeTab, setActiveTab] = useState<LibraryTab>(currentTab);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam as any)) {
      setActiveTab(tabParam as LibraryTab);
    }
  }, [tabParam]);

  const handleTabChange = (tab: LibraryTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState({}, "", url.toString());
  };

  const tabs: Array<{ id: LibraryTab; label: string; count?: number }> = [
    { id: "journal", label: "Journal", count: diaryEntries.length },
    { id: "watched", label: "Watched", count: watchedItems.length },
    { id: "watchlist", label: "Watchlist", count: watchlistItems.length },
    { id: "rankings", label: "Rankings", count: collections.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-8" id="library">
      {/* 1. Library Eyebrow & Barlow Condensed Main Heading */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest block">
            PERSONAL WORKSPACE
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-foreground mt-1">
            MY LIBRARY
          </h1>
        </div>

        {/* Global Personal Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsLogDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <PenLine size={14} />
            <span>Add to Journal</span>
          </button>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-secondary hover:bg-muted text-secondary-foreground border border-border text-xs font-semibold transition-colors"
          >
            <Plus size={14} />
            <span>New ranking</span>
          </Link>
        </div>
      </header>

      {/* 2. Thin Horizontal Section Navigation with Teal Active Underline */}
      <div className="border-b border-border">
        <nav aria-label="Library sections" className="flex items-center gap-6 sm:gap-8 -mb-px overflow-x-auto select-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 font-semibold text-sm transition-colors relative whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({tab.count})
                  </span>
                )}
                {/* Active Underline Treatment */}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Restrained Metadata Strip */}
      <div className="flex flex-wrap items-center gap-4 py-2 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground font-semibold">{totalRatedCount}</strong> rated titles
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span>
          <strong className="text-foreground font-semibold">{watchedItems.length}</strong> watched
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span>
          <strong className="text-primary font-semibold">{meanScore}</strong> mean /10
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span>
          <strong className="text-foreground font-semibold">{collections.length}</strong> collections
        </span>
      </div>

      {/* 4. Active Section Content */}
      <section aria-label="Selected Library Section">
        {activeTab === "journal" && (
          <CinematicTimeline
            entries={diaryEntries}
            undatedEntries={undatedEntries}
          />
        )}

        {activeTab === "watched" && (
          <WatchedGrid
            items={watchedItems}
          />
        )}

        {activeTab === "watchlist" && (
          <WatchlistGrid
            items={watchlistItems}
          />
        )}

        {activeTab === "rankings" && (
          <RankingsSection
            collections={collections}
            savedCollections={savedCollections}
          />
        )}
      </section>

      {/* Global Log Viewing Dialog */}
      {isLogDialogOpen && (
        <LogViewingDialog
          isOpen={isLogDialogOpen}
          onClose={() => setIsLogDialogOpen(false)}
          onSaved={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
