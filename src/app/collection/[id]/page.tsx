"use client";

import { useState, useEffect, useMemo, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  GitCompare,
  Trash2,
  AlertTriangle,
  Loader2,
  Plus,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { RatingDialog } from "@/components/rating-dialog";
import { LikeButton } from "@/components/social/like-button";
import { CommentsSection } from "@/components/social/comments-section";
import { calibrateOklchTheme } from "@/lib/palette";
import { CinematicArtworkBanner } from "@/components/cinematic-artwork-banner";
import { CinematicMediaCard } from "@/components/cinematic-media-card";

type SortOption = "score_desc" | "score_asc" | "order" | "title";
type FilterOption = "all" | "rated" | "unrated";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [collection, setCollection] = useState<any | null>(null);
  const [ratingsMap, setRatingsMap] = useState<Record<string, any>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion modals state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<any | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  // View preferences
  const [viewMode, setViewMode] = useState<"list" | "editorial" | "compact">("list");
  const [sortBy, setSortBy] = useState<SortOption>("score_desc");
  const [filterRated, setFilterRated] = useState<FilterOption>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Rating Modal
  const [selectedItemForRating, setSelectedItemForRating] = useState<any | null>(null);

  // Rubric Adjustment Modal
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [editingRubricCategories, setEditingRubricCategories] = useState<any[]>([]);
  const [savingRubric, setSavingRubric] = useState(false);
  const [customizeForCollectionOnly, setCustomizeForCollectionOnly] = useState(true);

  // Banner Customization Modal
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [bannerUrlInput, setBannerUrlInput] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // Add Entries Modal & TV Drilldown
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [addingMediaId, setAddingMediaId] = useState<number | null>(null);
  const [selectedTvShow, setSelectedTvShow] = useState<any | null>(null);
  const [drilldownSeason, setDrilldownSeason] = useState<any | null>(null);
  const [loadingTvDetails, setLoadingTvDetails] = useState(false);
  const [loadingSeasonData, setLoadingSeasonData] = useState(false);
  const [tvSeasonData, setTvSeasonData] = useState<any | null>(null);

  const handleOpenRubricModal = () => {
    if (!collection?.defaultRatingSystem?.categories) return;
    setEditingRubricCategories(
      collection.defaultRatingSystem.categories.map((c: any) => ({ ...c }))
    );
    setShowRubricModal(true);
  };

  const handleSaveRubric = async () => {
    if (!collection?.defaultRatingSystem?.id) return;
    setSavingRubric(true);
    try {
      if (customizeForCollectionOnly) {
        // Step 1: Duplicate the current rubric
        const dupRes = await fetch(`/api/rating-systems/${collection.defaultRatingSystem.id}/duplicate`, {
          method: "POST",
        });
        if (!dupRes.ok) throw new Error("Failed to create collection rubric");
        const dupData = await dupRes.json();
        const newSystemId = dupData.ratingSystem.id;

        // Step 2: Apply the updated categories and title
        const patchRes = await fetch(`/api/rating-systems/${newSystemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${collectionTitle} Rubric`,
            categories: editingRubricCategories.map((c, idx) => ({
              id: c.id,
              name: c.name,
              weight: c.weight,
              isRequired: c.isRequired,
              sortOrder: idx + 1,
            })),
          }),
        });
        if (!patchRes.ok) throw new Error("Failed to update collection rubric");
        const patchData = await patchRes.json();

        // Step 3: Assign to this collection
        await fetch(`/api/collections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultRatingSystemId: newSystemId }),
        });

        setCollection((prev: any) => ({
          ...prev,
          defaultRatingSystem: patchData.ratingSystem,
        }));
        setShowRubricModal(false);
      } else {
        const res = await fetch(`/api/rating-systems/${collection.defaultRatingSystem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: editingRubricCategories.map((c, idx) => ({
              id: c.id,
              name: c.name,
              weight: c.weight,
              isRequired: c.isRequired,
              sortOrder: idx + 1,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCollection((prev: any) => ({
            ...prev,
            defaultRatingSystem: data.ratingSystem,
          }));
          setShowRubricModal(false);
        }
      }
    } catch (err) {
      console.error("Failed to save rubric", err);
      alert("Failed to save rubric adjustments");
    } finally {
      setSavingRubric(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "backdrop");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload banner");
      }

      setBannerUrlInput(data.url);
    } catch (err: any) {
      alert(err?.message || "Failed to upload banner image");
    } finally {
      setBannerUploading(false);
    }
  };

  const handleSaveBanner = async () => {
    setSavingBanner(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backdropImage: bannerUrlInput.trim() || null,
        }),
      });

      if (res.ok) {
        setCollection((prev: any) => ({
          ...prev,
          backdropImage: bannerUrlInput.trim() || null,
        }));
        setShowBannerModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update banner");
      }
    } catch (err) {
      console.error("Failed to update banner", err);
      alert("Failed to update banner");
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSelectTvShow = async (showItem: any) => {
    setSelectedTvShow(showItem);
    setDrilldownSeason(null);
    setTvSeasonData(null);
    setLoadingTvDetails(true);
    try {
      const res = await fetch(`/api/tmdb/tv/${showItem.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTvShow(data);
      }
    } catch (err) {
      console.error("Failed to fetch TV details", err);
    } finally {
      setLoadingTvDetails(false);
    }
  };

  const handleSelectSeason = async (season: any) => {
    setDrilldownSeason(season);
    setLoadingSeasonData(true);
    try {
      const res = await fetch(`/api/tmdb/tv/${selectedTvShow.id}/season/${season.season_number}`);
      if (res.ok) {
        const data = await res.json();
        setTvSeasonData(data);
      }
    } catch (err) {
      console.error("Failed to fetch season data", err);
    } finally {
      setLoadingSeasonData(false);
    }
  };

  const handleAddTvEpisode = async (ep: any) => {
    setAddingMediaId(ep.id);
    try {
      const res = await fetch(`/api/collections/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: selectedTvShow.id,
          mediaType: "episode",
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setCollection((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              entries: [...(prev.entries || []), data.entry],
            };
          });
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to add episode");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add episode to ranking");
    } finally {
      setAddingMediaId(null);
    }
  };

  // Live search for adding entries
  useEffect(() => {
    if (!showAddModal || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingTmdb(true);
      try {
        const typeParam =
          collection?.collectionType === "tv_show"
            ? "tv"
            : collection?.collectionType === "movie_franchise"
              ? "movie"
              : "all";
        const res = await fetch(
          `/api/tmdb/search?q=${encodeURIComponent(searchQuery)}&type=${typeParam}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("TMDB search error", err);
      } finally {
        setIsSearchingTmdb(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [showAddModal, searchQuery, collection?.collectionType]);

  const handleAddTmdbItem = async (item: any) => {
    // If it's a TV show, open the seasons drilldown!
    if (item.media_type === "tv" || (!item.title && item.name)) {
      handleSelectTvShow(item);
      return;
    }

    setAddingMediaId(item.id);
    try {
      const res = await fetch(`/api/collections/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: item.media_type || (item.title ? "movie" : "tv"),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setCollection((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              entries: [...(prev.entries || []), data.entry],
            };
          });
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to add item");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add item to ranking");
    } finally {
      setAddingMediaId(null);
    }
  };

  const handleDeleteCollection = async () => {
    setDeletingCollection(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete collection");
      }
      router.push("/");
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Failed to delete collection");
      setDeletingCollection(false);
      setShowDeleteModal(false);
    }
  };

  const handleRemoveEntry = async () => {
    if (!entryToDelete) return;
    setDeletingEntry(true);
    try {
      const res = await fetch(`/api/collections/${id}/entries/${entryToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove entry");
      }
      setCollection((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          entries: (prev.entries || []).filter((e: any) => e.id !== entryToDelete.id),
        };
      });
      setEntryToDelete(null);
    } catch (err: any) {
      alert(err?.message || "Failed to remove entry");
    } finally {
      setDeletingEntry(false);
    }
  };

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

  const calibratedTheme = useMemo(() => {
    return calibrateOklchTheme(collection?.customCoverColor || "#89d5d5");
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
    if (!savedRating?.mediaItemId) return;
    setRatingsMap((prev) => {
      if (savedRating.cleared) {
        const next = { ...prev };
        delete next[savedRating.mediaItemId];
        return next;
      }
      return {
        ...prev,
        [savedRating.mediaItemId]: savedRating,
      };
    });
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

  const collectionTitle = collection.title || collection.name || "";
  const totalEntries = collection.entries?.length || 0;
  const ratedCount = Object.keys(ratingsMap).length;
  const rubricCategories = collection.defaultRatingSystem?.categories || [];

  return (
    <div className="min-h-screen pb-28">
      {/* =========================================================================
          ATMOSPHERIC 4K HEADER WITH CINEMATIC ARTWORK BANNER (Screen B Layout)
          ========================================================================= */}
      <CinematicArtworkBanner
        backdropPath={collection.backdropImage || collection.backdropPath}
        posterPath={collection.customCoverImage || collection.posterPath}
        clearLogoUrl={collection.clearLogoUrl}
        title={collectionTitle}
        className="border-b border-[#303b34]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-6">
          {/* Breadcrumb & Visibility row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#8fa095]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[#8fa095] hover:text-[#f1f0e9] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Library</span>
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
              <LikeButton collectionId={collection.id} />
              <Link
                href={`/compare?left=${collection.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#17201c] hover:bg-[#1f2b26] text-[#8fa095] hover:text-[#89d5d5] border border-[#3b4c40] transition-colors"
                title="Compare with another ranking"
              >
                <GitCompare size={12} className="text-[#89d5d5]" />
                <span>Compare</span>
              </Link>
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerUrlInput(collection.backdropImage || "");
                      setShowBannerModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#17201c] hover:bg-[#1f2b26] text-[#8fa095] hover:text-[#89d5d5] border border-[#3b4c40] transition-colors cursor-pointer"
                    title="Customize ranking banner artwork"
                  >
                    <ImageIcon size={12} className="text-[#89d5d5]" />
                    <span>Banner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                    title="Delete this entire ranking collection"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </>
              )}
              <span className="text-[11px] font-mono text-[#89d5d5]">
                {collection.collectionType === "tv_show"
                  ? "TV Series"
                  : collection.collectionType === "movie_franchise"
                    ? "Film Franchise"
                    : "Curated Collection"}{" "}
                · {totalEntries} Entries
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-4">
              {/* Transparent ClearLOGO */}
              {collection.clearLogoUrl && (
                <div className="py-1">
                  <img
                    src={collection.clearLogoUrl}
                    alt={collectionTitle}
                    className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)]"
                  />
                </div>
              )}

              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight text-[#f1f0e9] leading-[0.95] uppercase">
                {collectionTitle}
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
                <span className="text-[#89d5d5] font-medium">
                  {rubricCategories.length > 0 ? `${rubricCategories.length}-part weighted rubric` : "Weighted rubric"}
                </span>
              </div>
            </div>

            {/* Rubric Breakdown Panel */}
            <div className="lg:col-span-4 p-5 rounded-xl bg-[#141a17]/95 border border-[#303b34] space-y-2.5 text-xs backdrop-blur-sm">
              <div className="flex justify-between items-center pb-2 border-b border-[#28342d] font-semibold">
                <span className="font-display uppercase tracking-wider text-sm text-[#f1f0e9]">
                  {collection.defaultRatingSystem?.name || "Weighted Rubric"}
                </span>
                <span className="text-[#89d5d5]">
                  Scale 1–{collection.defaultRatingSystem?.scale || 10}
                </span>
              </div>

              {rubricCategories.length > 0 ? (
                rubricCategories.map((cat: any) => (
                  <div key={cat.id} className="flex justify-between text-[#9aa79e]">
                    <span>{cat.name}</span>
                    <span className="text-[#f1f0e9] font-bold">{cat.weight}x</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between text-[#9aa79e]"><span>Writing & Story</span><span className="text-[#f1f0e9] font-bold">8x</span></div>
                  <div className="flex justify-between text-[#9aa79e]"><span>Acting & Performance</span><span className="text-[#f1f0e9] font-bold">8x</span></div>
                  <div className="flex justify-between text-[#9aa79e]"><span>Cinematography</span><span className="text-[#f1f0e9] font-bold">7x</span></div>
                  <div className="flex justify-between text-[#9aa79e]"><span>Music & Sound Design</span><span className="text-[#f1f0e9] font-bold">3x</span></div>
                  <div className="flex justify-between text-[#9aa79e]"><span>Overall Impact</span><span className="text-[#89d5d5] font-bold">8x</span></div>
                </>
              )}

              {isOwner && collection.defaultRatingSystem && (
                <div className="pt-2 border-t border-[#28342d] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleOpenRubricModal}
                    className="text-[11px] text-[#89d5d5] hover:text-[#b2e8e8] flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Sliders size={12} />
                    <span>Adjust Rubric Weights</span>
                  </button>
                  <Link
                    href="/settings"
                    className="text-[11px] text-[#6c7d73] hover:text-[#9aa79e] transition-colors"
                  >
                    Manage in Settings
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </CinematicArtworkBanner>

      {/* =========================================================================
          CONTROLS BAR (Season Filter, View Modes, Sort)
          ========================================================================= */}
      <div className="sticky top-20 z-30 bg-[#111514]/95 backdrop-blur-md border-b border-[#303b34]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Left: Season Filter Pills & Add Item */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus size={13} />
                <span>Add Item</span>
              </button>
            )}

            {availableSeasons.length > 0 && (
              <div className="flex items-center gap-1.5">
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
          </div>

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
          <div className="text-center py-20 border border-dashed border-[#303b34] rounded-xl space-y-3">
            <p className="text-sm text-[#9aa79e]">No items in this ranking collection.</p>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#89d5d5] hover:bg-[#a5e2e2] text-[#102523] text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Your First Item</span>
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {processedEntries.map((entry: any, index: number) => {
              const media = entry.mediaItem;
              const hasScore = entry.score !== null;
              const isMovie =
                media.mediaType === "movie" ||
                collection.collectionType === "movie_franchise" ||
                (!media.seasonNumber && Boolean(media.posterPath));

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 sm:gap-6 p-4 rounded-xl border border-[#303b34] bg-[#141a17] hover:border-[#425247] transition-colors group"
                >
                  {/* Rank Numeral */}
                  <span className="w-8 sm:w-10 text-center font-display text-2xl sm:text-3xl font-bold text-[#8fa095] group-hover:text-[#89d5d5] transition-colors">
                    {index < 9 ? `0${index + 1}` : index + 1}
                  </span>

                  {/* Cinematic Card: 2:3 Portrait for Movies, 16:9 for Episodes */}
                  <div className={isMovie ? "w-[84px] sm:w-[96px] shrink-0" : "w-28 sm:w-36 shrink-0"}>
                    <CinematicMediaCard
                      stillPath={media.stillPath}
                      posterPath={media.posterPath}
                      title={media.title}
                      aspect={isMovie ? "poster" : "video"}
                    />
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
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

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setEntryToDelete(entry)}
                        className="p-1.5 rounded text-[#6c7d73] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                        title="Remove from this ranking"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
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

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#303b34] bg-[#141a17] overflow-hidden flex flex-col justify-between group hover:border-[#425247] transition-colors"
                >
                  <div className="relative overflow-hidden">
                    <CinematicMediaCard
                      stillPath={media.stillPath}
                      posterPath={media.posterPath}
                      title={media.title}
                      aspect={
                        collection.collectionType === "movie_franchise" ||
                        media.mediaType === "movie" ||
                        !media.seasonNumber
                          ? "poster"
                          : "video"
                      }
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

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setSelectedItemForRating(media)}
                        className="flex-1 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sliders size={13} />
                        <span>{hasScore ? "Adjust Score" : "Rate"}</span>
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setEntryToDelete(entry)}
                          className="p-2 rounded text-[#6c7d73] hover:text-red-400 hover:bg-red-500/10 border border-[#303b34] hover:border-red-500/30 transition-colors cursor-pointer"
                          title="Remove from this ranking"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stage 5: Critical Notes & Discussion */}
        <CommentsSection collectionId={collection.id} isOwner={isOwner} />
      </main>

      {/* Delete Collection Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#141a17] border border-red-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                Delete Entire Ranking
              </h3>
            </div>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-[#f1f0e9]">{collectionTitle}</strong>?
              This will remove all ranked entries and scores associated with this collection. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingCollection}
                className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCollection}
                disabled={deletingCollection}
                className="px-5 py-2.5 rounded bg-red-600 hover:bg-red-500 text-[#f1f0e9] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingCollection ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Yes, Delete Ranking</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Entry Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-[#141a17] border border-[#303b34] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#89d5d5]">
              <Trash2 className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                Remove Entry
              </h3>
            </div>
            <p className="text-xs text-[#9aa79e] leading-relaxed">
              Remove <strong className="text-[#f1f0e9]">{entryToDelete.mediaItem?.title}</strong> from this ranking?
              The item will be removed from this list, but your rating and TMDB metadata are preserved.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={deletingEntry}
                className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveEntry}
                disabled={deletingEntry}
                className="px-5 py-2.5 rounded bg-red-600 hover:bg-red-500 text-[#f1f0e9] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingEntry ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Entry</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rubric Adjustment Modal */}
      {showRubricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-[#141a17] border border-[#303b34] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#28342d]">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Adjust Rubric Weights
                </h3>
                <p className="text-xs text-[#8fa095] mt-0.5">
                  Calibrate the multiplier weights for each evaluation category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRubricModal(false)}
                className="text-[#8fa095] hover:text-[#f1f0e9] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {editingRubricCategories.map((cat, idx) => (
                <div
                  key={cat.id || idx}
                  className="p-3 rounded-lg border border-[#2b3730] bg-[#111613] flex items-center justify-between gap-4"
                >
                  <span className="font-semibold text-xs text-[#f1f0e9] flex-1">
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={cat.weight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEditingRubricCategories((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, weight: val } : c))
                        );
                      }}
                      className="w-28 accent-[#89d5d5] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#89d5d5] font-display w-8 text-right">
                      {cat.weight}x
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Scope Option */}
            <div className="p-3 rounded-lg bg-[#18211d] border border-[#303b34] space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizeForCollectionOnly}
                  onChange={(e) => setCustomizeForCollectionOnly(e.target.checked)}
                  className="rounded border-[#303b34] text-[#89d5d5] focus:ring-0 accent-[#89d5d5]"
                />
                <span className="text-xs font-semibold text-[#f1f0e9]">
                  Customize for this ranking only
                </span>
              </label>
              <p className="text-[11px] text-[#8fa095] pl-6 leading-relaxed">
                {customizeForCollectionOnly
                  ? "Creates a dedicated rubric for this ranking so your other collections remain untouched."
                  : "Updates this rating system globally across all rankings that share it."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#28342d]">
              <button
                type="button"
                onClick={() => setShowRubricModal(false)}
                disabled={savingRubric}
                className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRubric}
                disabled={savingRubric}
                className="px-5 py-2.5 rounded bg-[#89d5d5] hover:bg-[#a5e2e2] text-[#102523] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingRubric ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Weights</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl bg-[#141a17] border border-[#303b34] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#28342d]">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  {drilldownSeason
                    ? `${selectedTvShow?.name || "TV Show"} · ${drilldownSeason.name}`
                    : selectedTvShow
                      ? `${selectedTvShow.name || "TV Show"} · Seasons`
                      : "Add Entry to Ranking"}
                </h3>
                <p className="text-xs text-[#8fa095] mt-0.5">
                  {drilldownSeason
                    ? "Select individual episodes to add to your ranking."
                    : selectedTvShow
                      ? "Choose a season to view and rate its episodes."
                      : "Search TMDB to add movies or TV episodes directly into this ranking."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                  setSelectedTvShow(null);
                  setDrilldownSeason(null);
                }}
                className="text-[#8fa095] hover:text-[#f1f0e9] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Level 3: Episode Selection */}
            {drilldownSeason && selectedTvShow ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setDrilldownSeason(null);
                    setTvSeasonData(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Seasons</span>
                </button>

                {loadingSeasonData ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#8fa095]">
                    <Loader2 size={20} className="animate-spin text-[#89d5d5]" />
                    <span>Loading episodes...</span>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {tvSeasonData?.episodes?.map((ep: any) => {
                      const isAlreadyIn = (collection.entries || []).some(
                        (e: any) =>
                          e.mediaItem?.seasonNumber === ep.season_number &&
                          e.mediaItem?.episodeNumber === ep.episode_number &&
                          e.mediaItem?.title === ep.name
                      );
                      const isAdding = addingMediaId === ep.id;

                      return (
                        <div
                          key={ep.id}
                          className="p-3 rounded-lg border border-[#28342d] bg-[#111613] flex items-center justify-between gap-3 hover:border-[#3b4c40] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-16 h-10 bg-black rounded overflow-hidden shrink-0 border border-[#28342d]">
                              {ep.still_path ? (
                                <img
                                  src={getTmdbImageUrl(ep.still_path, "w300")}
                                  alt={ep.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6c7d73]">
                                  Ep {ep.episode_number}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-[#f1f0e9] truncate">
                                Ep {ep.episode_number}: {ep.name}
                              </h4>
                              {ep.air_date && (
                                <span className="text-[10px] text-[#8fa095] block mt-0.5">
                                  {ep.air_date.split("-")[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddTvEpisode(ep)}
                            disabled={isAlreadyIn || isAdding}
                            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                              isAlreadyIn
                                ? "bg-[#18211d] text-[#6c7d73] border border-[#2b3730] cursor-not-allowed"
                                : "bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40]"
                            }`}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : isAlreadyIn ? (
                              <>
                                <Check size={12} />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Add Episode</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : selectedTvShow ? (
              /* Level 2: Season Selection */
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTvShow(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#89d5d5] hover:underline cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Search</span>
                </button>

                {loadingTvDetails ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#8fa095]">
                    <Loader2 size={20} className="animate-spin text-[#89d5d5]" />
                    <span>Loading seasons...</span>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {selectedTvShow.seasons
                      ?.filter((s: any) => s.season_number > 0)
                      .map((season: any) => (
                        <div
                          key={season.id}
                          className="p-3 rounded-lg border border-[#28342d] bg-[#111613] flex items-center justify-between gap-3 hover:border-[#3b4c40] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-14 bg-black rounded overflow-hidden shrink-0 border border-[#28342d]">
                              {season.poster_path ? (
                                <img
                                  src={getTmdbImageUrl(season.poster_path, "w185")}
                                  alt={season.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6c7d73]">
                                  S{season.season_number}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-[#f1f0e9] truncate">
                                {season.name}
                              </h4>
                              <span className="text-[10px] text-[#8fa095] block mt-0.5">
                                {season.episode_count} Episodes
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectSeason(season)}
                            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] transition-all cursor-pointer shrink-0"
                          >
                            <span>View Episodes</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              /* Level 1: Search Box & General Results */
              <>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8fa095]"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies or TV shows (e.g. Alien, Severance)..."
                    autoFocus
                    className="w-full h-11 pl-9 pr-4 rounded-lg bg-[#18211d] border border-[#303b34] text-xs text-[#f1f0e9] placeholder-[#6c7d73] focus:outline-none focus:border-[#89d5d5] transition-colors"
                  />
                  {isSearchingTmdb && (
                    <Loader2
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#89d5d5] animate-spin"
                    />
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearchingTmdb && (
                    <div className="py-8 text-center text-xs text-[#8fa095]">
                      No matching titles found on TMDB.
                    </div>
                  )}

                  {searchResults.map((item) => {
                    const title = item.title || item.name;
                    const year = (item.release_date || item.first_air_date || "").split("-")[0];
                    const isTv = item.media_type === "tv" || (!item.title && item.name);
                    const isAlreadyIn = (collection.entries || []).some(
                      (e: any) => e.mediaItem?.tmdbId === item.id
                    );
                    const isAdding = addingMediaId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-[#28342d] bg-[#111613] flex items-center justify-between gap-3 hover:border-[#3b4c40] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 bg-black rounded overflow-hidden shrink-0 border border-[#28342d]">
                            {item.poster_path ? (
                              <img
                                src={getTmdbImageUrl(item.poster_path, "w185")}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6c7d73]">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-xs text-[#f1f0e9] truncate">
                              {title}
                            </h4>
                            <span className="text-[10px] text-[#8fa095] block mt-0.5">
                              {year ? `${year} · ` : ""}{isTv ? "TV Series" : "Movie"}
                            </span>
                          </div>
                        </div>

                        {isTv ? (
                          <button
                            type="button"
                            onClick={() => handleSelectTvShow(item)}
                            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] transition-all cursor-pointer shrink-0"
                          >
                            <span>Select Episodes</span>
                            <ChevronRight size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddTmdbItem(item)}
                            disabled={isAlreadyIn || isAdding}
                            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                              isAlreadyIn
                                ? "bg-[#18211d] text-[#6c7d73] border border-[#2b3730] cursor-not-allowed"
                                : "bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40]"
                            }`}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : isAlreadyIn ? (
                              <>
                                <Check size={12} />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Banner Customization Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-[#141a17] border border-[#303b34] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#28342d]">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-[#f1f0e9]">
                  Ranking Header Banner
                </h3>
                <p className="text-xs text-[#8fa095] mt-0.5">
                  Upload a custom backdrop image or specify an image URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                className="text-[#8fa095] hover:text-[#f1f0e9] p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Banner Preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Preview
              </label>
              <div className="aspect-[21/9] rounded-lg overflow-hidden bg-black border border-[#303b34] relative">
                {bannerUrlInput ? (
                  <img
                    src={bannerUrlInput}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#6c7d73] gap-1">
                    <ImageIcon size={20} className="text-[#3b4c40]" />
                    <span>No custom banner set (using default)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upload File */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Upload Custom Image
              </label>
              <input
                type="file"
                ref={bannerFileRef}
                onChange={handleBannerUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={bannerUploading}
                  className="px-4 py-2 rounded bg-[#1c2721] hover:bg-[#25342c] text-[#89d5d5] border border-[#3b4c40] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {bannerUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={13} />
                      <span>Choose Image File</span>
                    </>
                  )}
                </button>
                {bannerUrlInput && (
                  <button
                    type="button"
                    onClick={() => setBannerUrlInput("")}
                    className="px-3 py-2 text-xs text-[#8fa095] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear Banner
                  </button>
                )}
              </div>
            </div>

            {/* Or Paste URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#8fa095] uppercase tracking-wider block">
                Or Image URL
              </label>
              <input
                type="url"
                value={bannerUrlInput}
                onChange={(e) => setBannerUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-[#18211d] border border-[#303b34] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#28342d]">
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                disabled={savingBanner}
                className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBanner}
                disabled={savingBanner || bannerUploading}
                className="px-5 py-2.5 rounded bg-[#89d5d5] hover:bg-[#a5e2e2] text-[#102523] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingBanner ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>Apply Banner</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
