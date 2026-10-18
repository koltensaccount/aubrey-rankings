"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import {
  List,
  Grid,
  Sliders,
  ArrowLeft,
  Search,
  CheckCircle2,
  Calendar,
  Share2,
  Lock,
  Globe,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { RatingDialog } from "@/components/rating-dialog";

type SortOption = "score_desc" | "score_asc" | "order" | "title";
type FilterOption = "all" | "rated" | "unrated";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [collection, setCollection] = useState<any | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, any>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View preferences
  const [viewMode, setViewMode] = useState<"list" | "editorial" | "compact">("list");
  const [sortBy, setSortBy] = useState<SortOption>("score_desc");
  const [filterRated, setFilterRated] = useState<FilterOption>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Rating Modal
  const [selectedItemForRating, setSelectedItemForRating] = useState<any | null>(null);

  const handleVisibilityChange = async (newVisibility: "private" | "unlisted" | "public") => {
    setVisibilityUpdating(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (res.ok) {
        setVisibility(newVisibility);
      }
    } catch (err) {
      console.error("Failed to update visibility", err);
    } finally {
      setVisibilityUpdating(false);
    }
  };

  useEffect(() => {
    async function fetchCollection() {
      try {
        setLoading(true);
        const res = await fetch(`/api/collections/${id}`);
        if (!res.ok) {
          throw new Error("Failed to load collection");
        }
        const data = await res.json();
        setCollection(data.collection);
        setIsOwner(data.isOwner || false);
        setVisibility(data.collection.visibility || (data.collection.isPublic ? "public" : "private"));

        // Build ratings map
        const map: Record<string, any> = {};
        if (Array.isArray(data.ratings)) {
          for (const r of data.ratings) {
            map[r.mediaItemId] = r;
          }
        }
        setRatingsMap(map);
      } catch (err: any) {
        setError(err?.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchCollection();
  }, [id]);

  // Extract available seasons if TV show
  const availableSeasons = useMemo(() => {
    if (!collection?.entries) return [];
    const seasons = new Set<number>();
    for (const e of collection.entries) {
      if (e.mediaItem?.seasonNumber) {
        seasons.add(e.mediaItem.seasonNumber);
      }
    }
    return Array.from(seasons).sort((a, b) => a - b);
  }, [collection]);

  // Process and sort entries
  const processedEntries = useMemo(() => {
    if (!collection?.entries) return [];

    let list = collection.entries.map((entry: any) => {
      const media = entry.mediaItem;
      const userRating = ratingsMap[media.id];
      const score = userRating?.calculatedOverallScore ?? null;
      return {
        ...entry,
        score,
        userRating,
      };
    });

    // Filtering
    if (filterRated === "rated") {
      list = list.filter((e: any) => e.score !== null);
    } else if (filterRated === "unrated") {
      list = list.filter((e: any) => e.score === null);
    }

    if (selectedSeason !== "all") {
      const sNum = parseInt(selectedSeason, 10);
      list = list.filter((e: any) => e.mediaItem?.seasonNumber === sNum);
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter((e: any) =>
        e.mediaItem?.title?.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a: any, b: any) => {
      if (sortBy === "score_desc") {
        if (a.score === null && b.score === null) return a.sortOrder - b.sortOrder;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      } else if (sortBy === "score_asc") {
        if (a.score === null && b.score === null) return a.sortOrder - b.sortOrder;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return a.score - b.score;
      } else if (sortBy === "title") {
        return (a.mediaItem?.title || "").localeCompare(b.mediaItem?.title || "");
      } else {
        // Chronological / Order
        if (a.mediaItem?.seasonNumber !== b.mediaItem?.seasonNumber) {
          return (a.mediaItem?.seasonNumber || 0) - (b.mediaItem?.seasonNumber || 0);
        }
        if (a.mediaItem?.episodeNumber !== b.mediaItem?.episodeNumber) {
          return (a.mediaItem?.episodeNumber || 0) - (b.mediaItem?.episodeNumber || 0);
        }
        return a.sortOrder - b.sortOrder;
      }
    });

    return list;
  }, [collection, ratingsMap, filterRated, selectedSeason, searchFilter, sortBy]);

  const handleRatingSaved = (savedRating: any) => {
    setRatingsMap((prev) => ({
      ...prev,
      [savedRating.mediaItemId]: savedRating,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-[#89d5d5] border-t-transparent animate-spin" />
          <p className="text-xs text-[#8fa095]">Loading cinematic ranking...</p>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-display text-4xl uppercase text-[#f1f0e9]">Ranking Not Found</h2>
        <p className="text-sm text-[#9aa79e]">{error || "The requested collection could not be loaded."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#1c2721] text-[#89d5d5] border border-[#303b34] text-xs font-semibold"
        >
          <ArrowLeft size={14} />
          <span>Back to Library</span>
        </Link>
      </div>
    );
  }

  const isBlackMirror =
    collection.name.toLowerCase().includes("black mirror") ||
    collection.tmdbId === 42009;

  const backdropUrl = isBlackMirror
    ? "/prototype-art/black-mirror-wall.jpg"
    : collection.backdropPath
      ? getTmdbImageUrl(collection.backdropPath, "original")
      : "/prototype-art/black-mirror-wall.jpg";

  const totalEntries = collection.entries?.length || 0;
  const ratedCount = Object.keys(ratingsMap).length;

  return (
    <div className="min-h-screen pb-28">
      {/* =========================================================================
          ATMOSPHERIC 4K HEADER WITH TRANSPARENT CLEARLOGO (Screen B Layout)
          ========================================================================= */}
      <header className="relative overflow-hidden bg-[#101513] border-b border-[#303b34]">
        {/* Backdrop Art with Vignette */}
        <div className="absolute inset-0 z-0">
          <img
            src={backdropUrl}
            alt={collection.name}
            className="w-full h-full object-cover object-top opacity-35 filter contrast-125 saturate-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111514] via-[#111514]/75 to-[#111514]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111514] via-[#111514]/50 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-6">
          {/* Breadcrumb & Visibility row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#8fa095]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[#8fa095] hover:text-[#f1f0e9] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Feed</span>
            </Link>

            <div className="flex items-center gap-3">
              {isOwner && (
                <div className="flex items-center gap-1 p-1 rounded-md bg-[#18211d] border border-[#303b34]">
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("private")}
                    disabled={visibilityUpdating}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      visibility === "private"
                        ? "bg-[#303b34] text-[#f1f0e9]"
                        : "text-[#6c7d73] hover:text-[#9aa79e]"
                    }`}
                  >
                    <Lock size={10} />
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("unlisted")}
                    disabled={visibilityUpdating}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      visibility === "unlisted"
                        ? "bg-[#303b34] text-[#89d5d5]"
                        : "text-[#6c7d73] hover:text-[#9aa79e]"
                    }`}
                  >
                    <Share2 size={10} />
                    Unlisted
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("public")}
                    disabled={visibilityUpdating}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      visibility === "public"
                        ? "bg-[#89d5d5] text-[#111514]"
                        : "text-[#6c7d73] hover:text-[#9aa79e]"
                    }`}
                  >
                    <Globe size={10} />
                    Public
                  </button>
                </div>
              )}
              <span className="text-[11px] font-mono text-[#89d5d5]">
                {collection.collectionType === "tv_show" ? "TV Anthology" : "Canon"} · {totalEntries} Entries
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-4">
              {/* Authentic Transparent ClearLOGO for Black Mirror */}
              {isBlackMirror && (
                <div className="py-1">
                  <img
                    src="/prototype-art/black-mirror-logo.png"
                    alt="Black Mirror"
                    className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)]"
                  />
                </div>
              )}

              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight text-[#f1f0e9] leading-[0.95] uppercase">
                {collection.title || collection.name}
              </h1>

              {collection.description && (
                <p className="text-sm sm:text-base text-[#b1bfb7] max-w-2xl leading-relaxed">
                  {collection.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#8fa095] pt-2">
                <span>
                  <strong className="text-[#f1f0e9]">{ratedCount}</strong> of {totalEntries} rated
                </span>
                <span>·</span>
                <span className="text-[#89d5d5] font-medium">5-part weighted rubric</span>
              </div>
            </div>

            {/* Rubric Breakdown Panel */}
            <div className="lg:col-span-4 p-5 rounded-xl bg-[#141a17]/95 border border-[#303b34] space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-[#28342d] font-semibold">
                <span className="font-display uppercase tracking-wider text-sm text-[#f1f0e9]">
                  Weighted Rubric
                </span>
                <span className="text-[#89d5d5]">Scale 1–10</span>
              </div>
              <div className="flex justify-between text-[#9aa79e]"><span>Writing & Narrative</span><span className="text-[#f1f0e9] font-bold">8x</span></div>
              <div className="flex justify-between text-[#9aa79e]"><span>Acting & Performance</span><span className="text-[#f1f0e9] font-bold">8x</span></div>
              <div className="flex justify-between text-[#9aa79e]"><span>Cinematography & Direction</span><span className="text-[#f1f0e9] font-bold">7x</span></div>
              <div className="flex justify-between text-[#9aa79e]"><span>Music & Sound Design</span><span className="text-[#f1f0e9] font-bold">3x</span></div>
              <div className="flex justify-between text-[#9aa79e]"><span>Vibes & Resonant Dread</span><span className="text-[#89d5d5] font-bold">8x</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          CONTROLS BAR (Season Filter, View Modes, Sort)
          ========================================================================= */}
      <div className="sticky top-20 z-30 bg-[#111514]/95 backdrop-blur-md border-b border-[#303b34]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Season Filter Pills */}
          {availableSeasons.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedSeason("all")}
                className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                  selectedSeason === "all"
                    ? "bg-[#89d5d5] text-[#102523] font-semibold"
                    : "text-[#8fa095] hover:text-[#f1f0e9] hover:bg-[#1a221e]"
                }`}
              >
                All seasons
              </button>
              {availableSeasons.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeason(s.toString())}
                  className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap ${
                    selectedSeason === s.toString()
                      ? "bg-[#89d5d5] text-[#102523] font-semibold"
                      : "text-[#8fa095] hover:text-[#f1f0e9] hover:bg-[#1a221e]"
                  }`}
                >
                  Season {s}
                </button>
              ))}
            </div>
          )}

          {/* Right Controls: Sort & View Mode */}
          <div className="flex items-center justify-between sm:justify-end gap-3 ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#18211d] text-xs text-[#f1f0e9] border border-[#303b34] rounded px-3 py-1.5 focus:outline-none focus:border-[#89d5d5]"
            >
              <option value="score_desc">Sort: Highest Score</option>
              <option value="order">Sort: Chronological</option>
              <option value="title">Sort: Alphabetical</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#141a17] p-1 rounded border border-[#303b34]">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-[#25322a] text-[#89d5d5]"
                    : "text-[#8fa095] hover:text-[#f1f0e9]"
                }`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("editorial")}
                title="Grid view"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "editorial"
                    ? "bg-[#25322a] text-[#89d5d5]"
                    : "text-[#8fa095] hover:text-[#f1f0e9]"
                }`}
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RANKINGS ENTRIES (Screen B Layout)
          ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {processedEntries.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#303b34] rounded-xl space-y-2">
            <p className="text-sm text-[#9aa79e]">No items match the selected filter.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {processedEntries.map((entry: any, index: number) => {
              const media = entry.mediaItem;
              const hasScore = entry.score !== null;
              const stillUrl = media.stillPath
                ? getTmdbImageUrl(media.stillPath, "w500")
                : media.posterPath
                  ? getTmdbImageUrl(media.posterPath, "w500")
                  : "/prototype-art/san-junipero.jpg";

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 sm:gap-6 p-4 rounded-xl border border-[#303b34] bg-[#141a17] hover:border-[#425247] transition-colors group"
                >
                  {/* Rank Numeral */}
                  <span className="w-8 sm:w-10 text-center font-display text-2xl sm:text-3xl font-bold text-[#8fa095] group-hover:text-[#89d5d5] transition-colors">
                    {index < 9 ? `0${index + 1}` : index + 1}
                  </span>

                  {/* 16:9 Cinematic Still Card */}
                  <div className="w-24 sm:w-36 aspect-video rounded overflow-hidden bg-black shrink-0 relative">
                    <img
                      src={stillUrl}
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-width-0">
                    <div className="flex items-center gap-2 text-[11px] text-[#8fa095]">
                      {media.seasonNumber && media.episodeNumber && (
                        <span>
                          S{media.seasonNumber}, Ep {media.episodeNumber}
                        </span>
                      )}
                      {media.releaseDate && <span>· {media.releaseDate.split("-")[0]}</span>}
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-[#f1f0e9] uppercase tracking-tight truncate mt-0.5">
                      {media.title}
                    </h3>
                    {entry.userRating?.reviewText && (
                      <p className="text-xs text-[#9aa79e] line-clamp-1 italic mt-1">
                        &ldquo;{entry.userRating.reviewText}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Score & Rate Button */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {hasScore ? (
                        <div className="font-display text-2xl sm:text-3xl font-bold text-[#89d5d5]">
                          {entry.score.toFixed(1)}
                          <span className="text-xs text-[#8fa095] ml-1 font-sans">/ 10</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#6d7e74] font-medium">— Unrated</span>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedItemForRating(media)}
                      className="px-3 py-1.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sliders size={13} />
                      <span className="hidden sm:inline">Rate</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Editorial Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {processedEntries.map((entry: any, index: number) => {
              const media = entry.mediaItem;
              const hasScore = entry.score !== null;
              const stillUrl = media.stillPath
                ? getTmdbImageUrl(media.stillPath, "w500")
                : media.posterPath
                  ? getTmdbImageUrl(media.posterPath, "w500")
                  : "/prototype-art/san-junipero.jpg";

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#303b34] bg-[#141a17] overflow-hidden flex flex-col justify-between group hover:border-[#425247] transition-colors"
                >
                  <div className="aspect-video w-full bg-black relative overflow-hidden">
                    <img
                      src={stillUrl}
                      alt={media.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 font-display text-lg text-[#f1f0e9]">
                      #{index < 9 ? `0${index + 1}` : index + 1}
                    </div>
                    {hasScore && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/80 border border-[#89d5d5]/40 text-[#89d5d5] font-display text-base">
                        ★ {entry.score.toFixed(1)}
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-[#8fa095] block">
                        {media.seasonNumber ? `Season ${media.seasonNumber}, Ep ${media.episodeNumber}` : "Movie"}
                      </span>
                      <h3 className="font-display text-xl font-bold text-[#f1f0e9] uppercase tracking-tight mt-0.5">
                        {media.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => setSelectedItemForRating(media)}
                      className="w-full mt-2 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sliders size={13} />
                      <span>{hasScore ? "Adjust Score" : "Score Episode"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Interactive Rating Dialog */}
      {selectedItemForRating && (
        <RatingDialog
          isOpen={Boolean(selectedItemForRating)}
          onClose={() => setSelectedItemForRating(null)}
          mediaItem={selectedItemForRating}
          collectionId={collection.id}
          ratingSystem={collection.defaultRatingSystem}
          initialRating={ratingsMap[selectedItemForRating.id]}
          onRatingSaved={handleRatingSaved}
        />
      )}
    </div>
  );
}
