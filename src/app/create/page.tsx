"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Tv,
  Film,
  ListPlus,
  Search,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { Suspense } from "react";

type RankingType = "tv_show" | "movie_franchise" | "custom";

function CreateRankingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rankingType, setRankingType] = useState<RankingType>(
    (searchParams.get("type") as RankingType) || "tv_show"
  );
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("suggest") || ""
  );
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Custom collection fields
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live search when typing
  useEffect(() => {
    if (rankingType === "custom") return;
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const typeParam = rankingType === "tv_show" ? "tv" : "franchise";
        const res = await fetch(
          `/api/tmdb/search?q=${encodeURIComponent(searchQuery)}&type=${typeParam}`
        );
        if (!res.ok) {
          throw new Error("Search failed");
        }
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, rankingType]);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);

    try {
      let payload: any = {
        collectionType: rankingType,
      };

      if (rankingType === "tv_show") {
        if (!selectedItem) throw new Error("Please select a TV show from the search results");
        payload.title = selectedItem.name || selectedItem.title;
        payload.description = selectedItem.overview;
        payload.tmdbId = selectedItem.id;
        payload.importAllEpisodes = true;
      } else if (rankingType === "movie_franchise") {
        if (!selectedItem) throw new Error("Please select a movie franchise from search results");
        payload.title = selectedItem.name || selectedItem.title;
        payload.description = selectedItem.overview || "";
        payload.tmdbId = selectedItem.id;
      } else {
        if (!customTitle.trim()) throw new Error("Please provide a title for your collection");
        payload.title = customTitle.trim();
        payload.description = customDescription.trim();
      }

      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create collection");
      }

      router.push(`/collection/${data.id}`);
    } catch (err: any) {
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <span className="text-[11px] text-[#8fa095] uppercase tracking-wider block">
          Editorial Setup
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[#f1f0e9] mt-1">
          Create New Ranking
        </h1>
        <p className="text-xs text-[#9aa79e] mt-1">
          Select a format to build an episode-by-episode TV ranking, franchise canon, or custom list.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Select Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => {
            setRankingType("tv_show");
            setSelectedItem(null);
          }}
          className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
            rankingType === "tv_show"
              ? "border-[#89d5d5] bg-[#1a2520] ring-1 ring-[#89d5d5]/40"
              : "border-[#303b34] bg-[#141a17] hover:border-[#425247]"
          }`}
        >
          <Tv className={`h-5 w-5 mb-3 ${rankingType === "tv_show" ? "text-[#89d5d5]" : "text-[#8fa095]"}`} />
          <h3 className="font-display text-xl font-bold uppercase text-[#f1f0e9]">TV Show</h3>
          <p className="text-xs text-[#8fa095] mt-1">
            Rank every episode across all seasons (e.g. Black Mirror, Succession).
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRankingType("movie_franchise");
            setSelectedItem(null);
          }}
          className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
            rankingType === "movie_franchise"
              ? "border-[#89d5d5] bg-[#1a2520] ring-1 ring-[#89d5d5]/40"
              : "border-[#303b34] bg-[#141a17] hover:border-[#425247]"
          }`}
        >
          <Film className={`h-5 w-5 mb-3 ${rankingType === "movie_franchise" ? "text-[#89d5d5]" : "text-[#8fa095]"}`} />
          <h3 className="font-display text-xl font-bold uppercase text-[#f1f0e9]">Movie Franchise</h3>
          <p className="text-xs text-[#8fa095] mt-1">
            Rank all movies in a collection (e.g. Alien, Harry Potter, Dune).
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRankingType("custom");
            setSelectedItem(null);
          }}
          className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
            rankingType === "custom"
              ? "border-[#89d5d5] bg-[#1a2520] ring-1 ring-[#89d5d5]/40"
              : "border-[#303b34] bg-[#141a17] hover:border-[#425247]"
          }`}
        >
          <ListPlus className={`h-5 w-5 mb-3 ${rankingType === "custom" ? "text-[#89d5d5]" : "text-[#8fa095]"}`} />
          <h3 className="font-display text-xl font-bold uppercase text-[#f1f0e9]">Custom Index</h3>
          <p className="text-xs text-[#8fa095] mt-1">
            Mix movies, episodes, and personal entries into custom lists.
          </p>
        </button>
      </div>

      {/* Step 2: Content Selection */}
      {rankingType !== "custom" ? (
        <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8fa095] uppercase tracking-wider block">
              {rankingType === "tv_show" ? "Search TV Series (via TMDB)" : "Search Movie Franchise (via TMDB)"}
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8fa095]" />
              <input
                placeholder={
                  rankingType === "tv_show"
                    ? "e.g. Black Mirror, Severance, Twin Peaks..."
                    : "e.g. Alien, Star Wars, Blade Runner..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 text-xs rounded-lg bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#89d5d5] animate-spin" />
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Select Title
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {searchResults.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const poster = getTmdbImageUrl(item.poster_path, "w342");
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`flex gap-3.5 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#89d5d5] bg-[#1b2721] ring-1 ring-[#89d5d5]/50"
                          : "border-[#2b3730] bg-[#111613] hover:border-[#3d4f43]"
                      }`}
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt={item.name || item.title || "Poster"}
                          className="w-14 h-20 object-cover rounded shrink-0 bg-black"
                        />
                      ) : (
                        <div className="w-14 h-20 bg-[#18211d] rounded flex items-center justify-center shrink-0">
                          <Film className="h-5 w-5 text-[#8fa095]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-display text-base font-bold text-[#f1f0e9] uppercase tracking-tight truncate">
                            {item.name || item.title}
                          </h4>
                          {isSelected && <Check className="h-4 w-4 text-[#89d5d5] shrink-0" />}
                        </div>
                        <p className="text-[11px] text-[#8fa095]">
                          {item.first_air_date
                            ? item.first_air_date.split("-")[0]
                            : item.release_date
                              ? item.release_date.split("-")[0]
                              : ""}
                        </p>
                        <p className="text-[11px] text-[#9aa79e] line-clamp-2 leading-relaxed">
                          {item.overview}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedItem && (
            <div className="p-4 rounded-lg bg-[#18211d] border border-[#3b4c40] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#89d5d5] uppercase font-semibold block">Selected</span>
                <span className="font-display text-lg font-bold text-[#f1f0e9] uppercase">
                  {selectedItem.name || selectedItem.title}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="px-5 py-2.5 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {loading ? "Importing & Creating..." : "Create Ranking"}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Custom Collection Form */
        <div className="p-6 rounded-xl border border-[#303b34] bg-[#141a17] space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8fa095] uppercase tracking-wider block">
              Collection Title
            </label>
            <input
              placeholder="e.g. Modern Dystopian Sci-Fi: The Master Index"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#8fa095] uppercase tracking-wider block">
              Editorial Description
            </label>
            <textarea
              rows={3}
              placeholder="Explain the scope and curatorial criteria for this ranking index..."
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              className="w-full text-xs rounded-lg p-3 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !customTitle.trim()}
            className="w-full py-3 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Creating Index..." : "Create Collection"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CreateRankingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-[#89d5d5] animate-spin" />
        </div>
      }
    >
      <CreateRankingContent />
    </Suspense>
  );
}
