"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Star,
  Film,
  Tv,
  ArrowUpDown,
  Filter,
  Grid,
  List,
  Share2,
  Lock,
  Globe,
  Sliders,
  CheckCircle,
  Eye,
  Heart,
  Search,
  Sparkles,
  TrendingUp,
  Award,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View preferences
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("score_desc");
  const [filterRated, setFilterRated] = useState<FilterOption>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Rating Modal
  const [selectedItemForRating, setSelectedItemForRating] = useState<any | null>(null);

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
        if (b.score !== a.score) return b.score - a.score;
        return a.sortOrder - b.sortOrder;
      }
      if (sortBy === "score_asc") {
        if (a.score === null && b.score === null) return a.sortOrder - b.sortOrder;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        if (a.score !== b.score) return a.score - b.score;
        return a.sortOrder - b.sortOrder;
      }
      if (sortBy === "title") {
        return (a.mediaItem?.title || "").localeCompare(b.mediaItem?.title || "");
      }
      return a.sortOrder - b.sortOrder;
    });

    return list;
  }, [collection, ratingsMap, sortBy, filterRated, selectedSeason, searchFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const scores = Object.values(ratingsMap)
      .map((r: any) => r.calculatedOverallScore)
      .filter((s): s is number => s !== null && s !== undefined);

    const totalRated = scores.length;
    const avgScore =
      totalRated > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / totalRated) * 10) / 10
        : null;

    let highest: any = null;
    let lowest: any = null;

    if (collection?.entries && totalRated > 0) {
      let maxScore = -1;
      let minScore = 999999;
      for (const entry of collection.entries) {
        const r = ratingsMap[entry.mediaItemId];
        if (r?.calculatedOverallScore !== undefined && r?.calculatedOverallScore !== null) {
          if (r.calculatedOverallScore > maxScore) {
            maxScore = r.calculatedOverallScore;
            highest = entry.mediaItem;
          }
          if (r.calculatedOverallScore < minScore) {
            minScore = r.calculatedOverallScore;
            lowest = entry.mediaItem;
          }
        }
      }
    }

    return { totalRated, avgScore, highest, lowest };
  }, [collection, ratingsMap]);

  const handleRatingSaved = (newRating: any) => {
    setRatingsMap((prev) => ({
      ...prev,
      [newRating.mediaItemId]: newRating,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-10 w-48 mx-auto bg-card animate-pulse rounded-xl" />
        <p className="text-sm text-muted-foreground">Loading collection rankings...</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Collection Not Found</h2>
        <p className="text-sm text-muted-foreground">{error || "Unable to find the requested ranking collection."}</p>
        <Link href="/">
          <Button variant="outline">Back to Library</Button>
        </Link>
      </div>
    );
  }

  const backdropUrl = getTmdbImageUrl(
    collection.backdropImage || collection.customCoverImage,
    "original"
  );

  return (
    <div className="min-h-screen pb-20 space-y-8">
      {/* Hero Header */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[24/8] min-h-[260px] max-h-[420px] overflow-hidden bg-muted">
        <img
          src={backdropUrl}
          alt={collection.title}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

        <div className="absolute bottom-0 inset-x-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="backdrop-blur-md bg-black/60 text-xs text-amber-300 font-semibold border-amber-500/30">
                {collection.collectionType === "tv_show"
                  ? "TV Series Ranking"
                  : collection.collectionType === "movie_franchise"
                  ? "Movie Franchise"
                  : "Custom Collection"}
              </Badge>
              {collection.isPublic ? (
                <Badge variant="outline" className="text-[11px] gap-1 text-emerald-400 border-emerald-500/30">
                  <Globe className="h-3 w-3" /> Public
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" /> Private
                </Badge>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {collection.title}
            </h1>

            {collection.description && (
              <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-xl leading-relaxed">
                {collection.description}
              </p>
            )}
          </div>

          {/* Top Level Summary Cards */}
          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl backdrop-blur-md bg-black/60 border border-white/10 text-center min-w-[90px]">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Ranked
              </span>
              <p className="text-xl font-black text-white mt-0.5">
                {stats.totalRated} / {collection.entries.length}
              </p>
            </div>

            {stats.avgScore !== null && (
              <div className="p-3.5 rounded-2xl backdrop-blur-md bg-amber-500/15 border border-amber-500/40 text-center min-w-[90px]">
                <span className="text-[10px] text-amber-300/80 uppercase font-bold tracking-wider">
                  Average
                </span>
                <p className="text-xl font-black text-amber-300 mt-0.5">
                  ★ {stats.avgScore.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Controls Bar: Sort, Filter, Search, View Mode */}
        <div className="p-4 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter entries..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-9 pl-8 text-xs bg-secondary/50"
              />
            </div>

            {/* Season Filter (if TV Show) */}
            {availableSeasons.length > 1 && (
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="all">All Seasons</option>
                {availableSeasons.map((s) => (
                  <option key={s} value={String(s)}>
                    Season {s}
                  </option>
                ))}
              </select>
            )}

            {/* Rated/Unrated Filter */}
            <div className="flex rounded-lg border border-border/70 p-0.5 bg-secondary/30 text-xs">
              <button
                type="button"
                onClick={() => setFilterRated("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterRated === "all" ? "bg-amber-500 text-stone-950 font-bold" : "text-muted-foreground hover:text-white"
                }`}
              >
                All ({collection.entries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRated("rated")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterRated === "rated" ? "bg-amber-500 text-stone-950 font-bold" : "text-muted-foreground hover:text-white"
                }`}
              >
                Rated ({stats.totalRated})
              </button>
              <button
                type="button"
                onClick={() => setFilterRated("unrated")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterRated === "unrated" ? "bg-amber-500 text-stone-950 font-bold" : "text-muted-foreground hover:text-white"
                }`}
              >
                Unrated ({collection.entries.length - stats.totalRated})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="score_desc">Score (Highest First)</option>
                <option value="score_asc">Score (Lowest First)</option>
                <option value="order">Original Order / Air Date</option>
                <option value="title">Title (A–Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border/70 p-0.5 bg-secondary/30">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-accent text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List View"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-accent text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Entries Display */}
        {processedEntries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No entries match your selected filter.
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {processedEntries.map((entry: any, index: number) => {
              const media = entry.mediaItem;
              const hasScore = entry.score !== null;
              const imgUrl = getTmdbImageUrl(
                media.stillPath || media.posterPath || media.backdropPath,
                "original"
              );

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedItemForRating(media)}
                  className="group relative rounded-2xl overflow-hidden border border-border/70 bg-card hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-200 cursor-pointer flex flex-col"
                >
                  {/* Rank Badge if sorted by score */}
                  {sortBy.startsWith("score") && hasScore && (
                    <div className="absolute top-2.5 left-2.5 z-10 h-7 w-7 rounded-xl bg-black/80 backdrop-blur-md border border-amber-500/40 text-amber-300 font-black text-xs flex items-center justify-center shadow-lg">
                      #{index + 1}
                    </div>
                  )}

                  {/* Artwork */}
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted relative">
                    <img
                      src={imgUrl}
                      alt={media.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />

                    {/* Score Badge */}
                    <div className="absolute bottom-2.5 right-2.5">
                      {hasScore ? (
                        <Badge variant="score" className="text-xs px-2.5 py-0.5 shadow-md">
                          ★ {entry.score.toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-black/60 text-muted-foreground border-white/10">
                          Unrated
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      {media.seasonNumber && media.episodeNumber && (
                        <span className="text-[11px] font-semibold text-amber-400/90 tracking-wide uppercase">
                          S{media.seasonNumber} &bull; E{media.episodeNumber}
                        </span>
                      )}
                      <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors line-clamp-1">
                        {media.title}
                      </h3>
                      {media.overview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {media.overview}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50">
                      <span>{media.releaseDate || "—"}</span>
                      <span className="text-amber-400 font-medium group-hover:underline">
                        {hasScore ? "Edit Score" : "Rate Now"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* COMPACT LIST VIEW */
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border/80">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 hidden md:table-cell">Episode</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Release Date</th>
                  <th className="py-3 px-4 text-right">Weighted Score</th>
                  <th className="py-3 px-4 w-24 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {processedEntries.map((entry: any, index: number) => {
                  const media = entry.mediaItem;
                  const hasScore = entry.score !== null;

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedItemForRating(media)}
                      className="hover:bg-accent/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-center font-bold text-xs text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getTmdbImageUrl(
                              media.stillPath || media.posterPath,
                              "w300"
                            )}
                            alt={media.title}
                            className="w-10 h-7 object-cover rounded bg-muted hidden sm:block shrink-0"
                          />
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                            {media.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-xs text-muted-foreground">
                        {media.seasonNumber && media.episodeNumber
                          ? `S${media.seasonNumber} E${media.episodeNumber}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-xs text-muted-foreground">
                        {media.releaseDate || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasScore ? (
                          <Badge variant="score" className="text-xs">
                            ★ {entry.score.toFixed(1)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-400">
                          {hasScore ? "Edit" : "Rate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rating Dialog / Modal */}
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
