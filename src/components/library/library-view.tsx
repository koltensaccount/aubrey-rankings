"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Bookmark,
  ListFilter,
  Plus,
  PenLine,
  Star,
  FileText,
  Lock,
  Globe,
  Link2,
} from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { SpoilerConcealedText } from "@/components/reviews/spoiler-concealed-text";
import { reviewScoreOnTen } from "@/lib/review-rating";
import { CinematicTimeline, type TimelineEntry } from "./cinematic-timeline";
import { WatchedGrid, type WatchedItem } from "./watched-grid";
import { WatchlistGrid, type WatchlistGridItem } from "./watchlist-grid";
import { RankingsSection } from "./rankings-section";
import { LogViewingDialog } from "./log-viewing-dialog";

export type LibraryTab = "journal" | "watched" | "watchlist" | "rankings";
export type JournalSubTab = "timeline" | "reviews" | "ratings" | "watched";

interface LibraryViewProps {
  initialTab?: LibraryTab;
  initialFilter?: string;
  diaryEntries: TimelineEntry[];
  totalDiaryCount?: number;
  userReviews?: any[];
  standaloneRatings?: any[];
  watchedOnlyRecords?: any[];
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
  watchedItems: WatchedItem[];
  watchlistItems: WatchlistGridItem[];
  collections: any[];
  savedCollections?: any[];
  totalRatedCount: number;
  meanScore: string;
}

export function LibraryView({
  initialTab = "journal",
  initialFilter,
  diaryEntries,
  totalDiaryCount,
  userReviews = [],
  standaloneRatings = [],
  watchedOnlyRecords = [],
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
  const filterParam = searchParams?.get("filter")?.toLowerCase() || initialFilter;

  const validTabs: LibraryTab[] = ["journal", "watched", "watchlist", "rankings"];
  const currentTab: LibraryTab = validTabs.includes(tabParam as any)
    ? (tabParam as LibraryTab)
    : validTabs.includes(initialTab)
    ? initialTab
    : "journal";

  const [activeTab, setActiveTab] = useState<LibraryTab>(currentTab);

  // Sub-tabs in Journal
  const resolveInitialSubTab = (): JournalSubTab => {
    if (filterParam === "drafts" || filterParam === "published" || filterParam === "reviews") {
      return "reviews";
    }
    if (filterParam === "ratings") return "ratings";
    if (filterParam === "watched") return "watched";
    return "timeline";
  };

  const [journalSubTab, setJournalSubTab] = useState<JournalSubTab>(resolveInitialSubTab());
  const [reviewFilter, setReviewFilter] = useState<"all" | "published" | "drafts">(
    filterParam === "drafts" ? "drafts" : filterParam === "published" ? "published" : "all"
  );
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam as any)) {
      setActiveTab(tabParam as LibraryTab);
    }
  }, [tabParam]);

  useEffect(() => {
    if (filterParam) {
      if (filterParam === "drafts") {
        setJournalSubTab("reviews");
        setReviewFilter("drafts");
      } else if (filterParam === "published") {
        setJournalSubTab("reviews");
        setReviewFilter("published");
      } else if (filterParam === "ratings") {
        setJournalSubTab("ratings");
      } else if (filterParam === "watched") {
        setJournalSubTab("watched");
      }
    }
  }, [filterParam]);

  const handleTabChange = (tab: LibraryTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("filter");
    window.history.pushState({}, "", url.toString());
  };

  const handleJournalSubTabChange = (sub: JournalSubTab) => {
    setJournalSubTab(sub);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "journal");
    if (sub === "reviews") {
      url.searchParams.set("filter", reviewFilter === "all" ? "reviews" : reviewFilter);
    } else if (sub === "ratings") {
      url.searchParams.set("filter", "ratings");
    } else if (sub === "watched") {
      url.searchParams.set("filter", "watched");
    } else {
      url.searchParams.delete("filter");
    }
    window.history.pushState({}, "", url.toString());
  };

  const handleReviewFilterChange = (f: "all" | "published" | "drafts") => {
    setReviewFilter(f);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "journal");
    url.searchParams.set("filter", f);
    window.history.pushState({}, "", url.toString());
  };

  const draftCount = userReviews.filter(
    (r) => r.status === "draft" || r.status === "unpublished"
  ).length;

  const tabs: Array<{ id: LibraryTab; label: string; count?: number }> = [
    { id: "journal", label: "Journal", count: totalDiaryCount ?? diaryEntries.length },
    { id: "watched", label: "Watched", count: watchedItems.length },
    { id: "watchlist", label: "Watchlist", count: watchlistItems.length },
    { id: "rankings", label: "Rankings", count: collections.length },
  ];

  const filteredReviews = userReviews.filter((r) => {
    if (reviewFilter === "drafts") return r.status === "draft" || r.status === "unpublished";
    if (reviewFilter === "published") return r.status === "published";
    return true;
  });

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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-colors shadow-xs cursor-pointer"
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
        <nav
          aria-label="Library sections"
          className="flex items-center gap-6 sm:gap-8 -mb-px overflow-x-auto select-none"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`py-3.5 px-1 font-semibold text-sm sm:text-base transition-colors relative cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? "text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary font-bold"
                        : "bg-surface text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {/* Active Teal Underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Sub-View Navigation for Journal Tab */}
      {activeTab === "journal" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Scrollable sub-tab bar on mobile */}
          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex items-center gap-1.5 bg-surface p-1 rounded-button border border-border text-xs select-none whitespace-nowrap min-w-max">
              <button
                type="button"
                onClick={() => handleJournalSubTabChange("timeline")}
                className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  journalSubTab === "timeline"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Viewing Timeline
              </button>
              <button
                type="button"
                onClick={() => handleJournalSubTabChange("reviews")}
                className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  journalSubTab === "reviews"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Reviews &amp; Drafts</span>
                {draftCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-background/40 text-[10px] font-mono">
                    {draftCount} drafts
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleJournalSubTabChange("ratings")}
                className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  journalSubTab === "ratings"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Standalone Ratings</span>
                {standaloneRatings.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-background/40 text-[10px] font-mono">
                    {standaloneRatings.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleJournalSubTabChange("watched")}
                className={`px-3 py-1.5 rounded-button font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  journalSubTab === "watched"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Watched Only</span>
                {watchedOnlyRecords.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-background/40 text-[10px] font-mono">
                    {watchedOnlyRecords.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Review Filter Pills (when reviews sub-tab is active) */}
          {journalSubTab === "reviews" && (
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="inline-flex items-center gap-1 bg-surface p-0.5 rounded-button border border-border text-xs whitespace-nowrap min-w-max">
                {(
                  [
                    { id: "all", label: "All Reviews" },
                    { id: "published", label: "Published" },
                    { id: "drafts", label: `Drafts (${draftCount})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleReviewFilterChange(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      reviewFilter === f.id
                        ? "bg-card text-foreground shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Active Tab Content */}
      <main className="min-h-[500px]">
        {activeTab === "journal" && (
          <>
            {journalSubTab === "timeline" && (
              <CinematicTimeline
                initialEntries={diaryEntries}
                totalDiaryCount={totalDiaryCount}
                undatedEntries={undatedEntries}
                onViewingLogged={() => router.refresh()}
                onEntryUpdated={() => router.refresh()}
                onEntryDeleted={() => router.refresh()}
              />
            )}

            {/* Preserved Reviews & Drafts Section */}
            {journalSubTab === "reviews" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="font-display text-xl uppercase tracking-tight text-foreground">
                    {reviewFilter === "drafts"
                      ? "Draft Reviews"
                      : reviewFilter === "published"
                      ? "Published Reviews"
                      : "All Reviews & Drafts"}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {filteredReviews.length} records
                  </span>
                </div>

                {filteredReviews.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground bg-card/40 rounded-xl border border-dashed border-border p-6">
                    No {reviewFilter !== "all" ? reviewFilter : ""} reviews found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReviews.map((r: any) => {
                      const isEpisode =
                        r.mediaItem?.mediaType === "episode" ||
                        Boolean(r.mediaItem?.seasonNumber && r.mediaItem?.episodeNumber);
                      const isDraft = r.status === "draft" || r.status === "unpublished";
                      const score = r.rating ? reviewScoreOnTen(r.rating) : null;
                      const targetLink = `/media/${encodeURIComponent(r.mediaItemId)}?journal=1`;

                      return (
                        <article
                          key={r.id}
                          className="p-4 sm:p-5 rounded-card bg-card border border-border hover:border-primary/40 transition-colors shadow-xs"
                        >
                          <div className="flex items-start gap-4">
                            <Link href={targetLink} className="shrink-0">
                              <div
                                className={`rounded overflow-hidden border border-border ${
                                  isEpisode ? "w-24 sm:w-28 aspect-video" : "w-14 sm:w-16 aspect-[2/3]"
                                }`}
                              >
                                <CinematicMediaCard
                                  title={r.mediaItem?.title || "Title"}
                                  posterPath={
                                    isEpisode
                                      ? r.mediaItem?.stillPath || r.mediaItem?.posterPath
                                      : r.mediaItem?.posterPath
                                  }
                                  stillPath={r.mediaItem?.stillPath}
                                  aspect={isEpisode ? "video" : "poster"}
                                />
                              </div>
                            </Link>

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    isDraft
                                      ? "bg-surface-elevated text-muted-foreground border border-border"
                                      : "bg-primary/10 text-primary border border-primary/20"
                                  }`}
                                >
                                  {isDraft ? "Draft" : `Published · ${r.visibility || "Public"}`}
                                </span>
                                <span className="text-muted-foreground/60">·</span>
                                <span className="text-muted-foreground font-bold">
                                  {isEpisode
                                    ? r.mediaItem?.seasonNumber && r.mediaItem?.episodeNumber
                                      ? `S${r.mediaItem.seasonNumber} · E${r.mediaItem.episodeNumber}`
                                      : "Episode"
                                    : r.mediaItem?.mediaType === "tv"
                                    ? "TV Series"
                                    : "Film"}
                                </span>
                                {score !== null && (
                                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                                    <Star size={11} className="fill-primary" />
                                    <span>{score.toFixed(1)} / 10</span>
                                  </span>
                                )}
                              </div>

                              <h4 className="font-display text-xl uppercase tracking-tight text-foreground truncate">
                                <Link href={targetLink} className="hover:text-primary transition-colors">
                                  {r.mediaItem?.title}
                                </Link>
                              </h4>

                              {(r.content || r.draftContent) && (
                                <div className="text-xs text-foreground/90 italic pt-0.5">
                                  <SpoilerConcealedText
                                    content={r.content || r.draftContent}
                                    isSpoiler={r.isSpoiler}
                                    quoteStyle
                                  />
                                </div>
                              )}

                              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {r.updatedAt
                                    ? `Updated ${new Date(r.updatedAt).toLocaleDateString()}`
                                    : ""}
                                </span>
                                <Link
                                  href={targetLink}
                                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                                >
                                  <PenLine size={12} />
                                  <span>{isDraft ? "Continue Draft" : "Edit Review"}</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Preserved Standalone Ratings Section */}
            {journalSubTab === "ratings" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="font-display text-xl uppercase tracking-tight text-foreground">
                    Standalone Ratings
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {standaloneRatings.length} rated titles without a full written review
                  </span>
                </div>

                {standaloneRatings.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground bg-card/40 rounded-xl border border-dashed border-border p-6">
                    No standalone ratings found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {standaloneRatings.map((rating: any) => {
                      const isEpisode =
                        rating.mediaItem?.mediaType === "episode" ||
                        Boolean(rating.mediaItem?.seasonNumber && rating.mediaItem?.episodeNumber);
                      const score = reviewScoreOnTen(rating);
                      const targetLink = `/media/${encodeURIComponent(rating.mediaItemId)}?journal=1`;

                      return (
                        <article
                          key={rating.id}
                          className="p-3 rounded-card bg-card border border-border flex items-center gap-3 hover:border-primary/40 transition-colors shadow-xs"
                        >
                          <Link href={targetLink} className="shrink-0">
                            <div
                              className={`rounded overflow-hidden border border-border ${
                                isEpisode ? "w-16 aspect-video" : "w-10 aspect-[2/3]"
                              }`}
                            >
                              <CinematicMediaCard
                                title={rating.mediaItem?.title || "Title"}
                                posterPath={
                                  isEpisode
                                    ? rating.mediaItem?.stillPath || rating.mediaItem?.posterPath
                                    : rating.mediaItem?.posterPath
                                }
                                stillPath={rating.mediaItem?.stillPath}
                                aspect={isEpisode ? "video" : "poster"}
                              />
                            </div>
                          </Link>

                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="font-display text-base uppercase tracking-tight text-foreground truncate">
                              <Link href={targetLink} className="hover:text-primary transition-colors">
                                {rating.mediaItem?.title}
                              </Link>
                            </h4>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                {isEpisode ? "Episode" : "Film"}
                              </span>
                              {score !== null && (
                                <span className="inline-flex items-center gap-1 font-bold text-primary text-xs">
                                  <Star size={11} className="fill-primary" />
                                  <span>{score.toFixed(1)} / 10</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Preserved Watched-Only Section */}
            {journalSubTab === "watched" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="font-display text-xl uppercase tracking-tight text-foreground">
                    Watched-Only Titles
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {watchedOnlyRecords.length} titles marked watched without a numerical score
                  </span>
                </div>

                {watchedOnlyRecords.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground bg-card/40 rounded-xl border border-dashed border-border p-6">
                    No watched-only records found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {watchedOnlyRecords.map((item: any) => {
                      const isEpisode =
                        item.mediaItem?.mediaType === "episode" ||
                        Boolean(item.mediaItem?.seasonNumber && item.mediaItem?.episodeNumber);
                      const targetLink = `/media/${encodeURIComponent(item.mediaItemId)}?journal=1`;

                      return (
                        <article
                          key={item.id}
                          className="p-3 rounded-card bg-card border border-border flex items-center justify-between gap-3 hover:border-primary/40 transition-colors shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Link href={targetLink} className="shrink-0">
                              <div
                                className={`rounded overflow-hidden border border-border ${
                                  isEpisode ? "w-16 aspect-video" : "w-10 aspect-[2/3]"
                                }`}
                              >
                                <CinematicMediaCard
                                  title={item.mediaItem?.title || "Title"}
                                  posterPath={
                                    isEpisode
                                      ? item.mediaItem?.stillPath || item.mediaItem?.posterPath
                                      : item.mediaItem?.posterPath
                                  }
                                  stillPath={item.mediaItem?.stillPath}
                                  aspect={isEpisode ? "video" : "poster"}
                                />
                              </div>
                            </Link>

                            <div className="min-w-0 flex-1">
                              <h4 className="font-display text-base uppercase tracking-tight text-foreground truncate">
                                <Link href={targetLink} className="hover:text-primary transition-colors">
                                  {item.mediaItem?.title}
                                </Link>
                              </h4>
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                {isEpisode ? "Episode" : "Film"} · Watched
                              </span>
                            </div>
                          </div>

                          <Link
                            href={targetLink}
                            className="shrink-0 px-2.5 py-1 rounded-button bg-surface border border-border text-[11px] font-semibold text-primary hover:bg-surface-elevated transition-colors"
                          >
                            Rate
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "watched" && (
          <WatchedGrid
            initialItems={watchedItems}
            onLogViewing={() => router.refresh()}
          />
        )}

        {activeTab === "watchlist" && (
          <WatchlistGrid
            items={watchlistItems}
            onItemRemoved={() => router.refresh()}
            onItemLogged={() => router.refresh()}
          />
        )}

        {activeTab === "rankings" && (
          <RankingsSection
            collections={collections}
            savedCollections={savedCollections}
          />
        )}
      </main>

      {/* Global Log Dialog Trigger */}
      {isLogDialogOpen && (
        <LogViewingDialog
          isOpen={isLogDialogOpen}
          onClose={() => setIsLogDialogOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
