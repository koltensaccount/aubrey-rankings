"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tv,
  Film,
  ListPlus,
  Search,
  Sparkles,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
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
        payload.title = selectedItem.name;
        payload.description = selectedItem.overview;
        payload.tmdbId = selectedItem.id;
        payload.importAllEpisodes = true;
      } else if (rankingType === "movie_franchise") {
        if (!selectedItem) throw new Error("Please select a movie franchise from search results");
        payload.title = selectedItem.name;
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Create New Ranking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a mode to build an episode-by-episode TV ranking, movie franchise, or custom list.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
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
          className={`p-5 rounded-2xl border text-left transition-all ${
            rankingType === "tv_show"
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50"
              : "border-border/80 bg-card hover:border-border"
          }`}
        >
          <Tv className={`h-6 w-6 mb-3 ${rankingType === "tv_show" ? "text-amber-400" : "text-muted-foreground"}`} />
          <h3 className="font-bold text-white text-base">TV Show</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Rank every episode across all seasons (e.g. Black Mirror, Succession).
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRankingType("movie_franchise");
            setSelectedItem(null);
          }}
          className={`p-5 rounded-2xl border text-left transition-all ${
            rankingType === "movie_franchise"
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50"
              : "border-border/80 bg-card hover:border-border"
          }`}
        >
          <Film className={`h-6 w-6 mb-3 ${rankingType === "movie_franchise" ? "text-amber-400" : "text-muted-foreground"}`} />
          <h3 className="font-bold text-white text-base">Movie Franchise</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Rank all movies in a collection (e.g. Harry Potter, The Lord of the Rings).
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRankingType("custom");
            setSelectedItem(null);
          }}
          className={`p-5 rounded-2xl border text-left transition-all ${
            rankingType === "custom"
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50"
              : "border-border/80 bg-card hover:border-border"
          }`}
        >
          <ListPlus className={`h-6 w-6 mb-3 ${rankingType === "custom" ? "text-amber-400" : "text-muted-foreground"}`} />
          <h3 className="font-bold text-white text-base">Custom Collection</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mix movies, episodes, and personal entries into custom lists.
          </p>
        </button>
      </div>

      {/* Step 2: Content Selection */}
      {rankingType !== "custom" ? (
        <Card className="p-6 space-y-6 border-border/80 bg-card/80">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">
              {rankingType === "tv_show" ? "Search TV Show" : "Search Movie Franchise / Collection"}
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  rankingType === "tv_show"
                    ? "e.g. Black Mirror, Severance, Breaking Bad..."
                    : "e.g. Harry Potter, Star Wars, Alien..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base bg-secondary/40"
              />
              {isSearching && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Results
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {searchResults.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const poster = getTmdbImageUrl(item.poster_path, "w185");
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/15"
                          : "border-border/70 bg-card hover:border-border hover:bg-secondary/40"
                      }`}
                    >
                      <img
                        src={poster}
                        alt={item.name}
                        className="w-12 h-16 object-cover rounded-lg bg-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">
                          {item.name}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.overview || "No overview available."}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Item Preview */}
          {selectedItem && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={getTmdbImageUrl(selectedItem.poster_path, "w185")}
                  alt={selectedItem.name}
                  className="w-10 h-14 object-cover rounded-lg"
                />
                <div>
                  <Badge variant="default" className="text-[10px] mb-1">
                    Ready to Import
                  </Badge>
                  <h4 className="font-bold text-white text-sm">{selectedItem.name}</h4>
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="font-bold shadow-md shadow-amber-500/20"
              >
                {loading ? "Importing Episodes..." : "Create Ranking"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        /* Custom Collection Form */
        <Card className="p-6 space-y-4 border-border/80 bg-card/80">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-white">Collection Title</label>
            <Input
              placeholder="e.g. Favorite Science Fiction"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="h-11 bg-secondary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-white">Description (Optional)</label>
            <Input
              placeholder="e.g. My all-time top science fiction movies and single TV episodes."
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              className="h-11 bg-secondary/40"
            />
          </div>
          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleCreate}
              disabled={loading || !customTitle.trim()}
              className="font-bold shadow-md shadow-amber-500/20"
            >
              {loading ? "Creating..." : "Create Collection"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function CreateRankingPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-10 text-center text-sm text-muted-foreground">Loading creator...</div>}>
      <CreateRankingContent />
    </Suspense>
  );
}
