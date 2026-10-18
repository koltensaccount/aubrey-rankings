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
import { CinematicSlider } from "@/components/cinematic-slider";
import { getItemRatingStatus } from "@/lib/scoring";

type SortOption = "score_desc" | "score_asc" | "order" | "title";
type FilterOption = "all" | "rated" | "in_progress" | "unrated";

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

  const rubricCategories = collection?.defaultRatingSystem?.categories || [];

  // Calculate accurate collection rating progress
  const { completedCount, inProgressCount, unratedCount, completionPercentage } = useMemo(() => {
    if (!collection?.entries) return { completedCount: 0, inProgressCount: 0, unratedCount: 0, completionPercentage: 0 };
    const categories = collection.defaultRatingSystem?.categories || [];
    let completed = 0;
    let inProgress = 0;
    let unrated = 0;

    for (const entry of collection.entries) {
      const ur = ratingsMap[entry.mediaItem?.id];
      const status = getItemRatingStatus(categories, ur);
      if (status.state === "rated") {
        completed++;
      } else if (status.state === "in_progress") {
        inProgress++;
      } else {
        unrated++;
      }
    }

    const total = collection.entries.length;
    const pct = total > 0 ? Math.round((completed / Math.max(1, total)) * 100) : 0;
    return {
      completedCount: completed,
      inProgressCount: inProgress,
      unratedCount: unrated,
      completionPercentage: pct,
    };
  }, [collection, ratingsMap]);

  // Process and sort entries
  const processedEntries = useMemo(() => {
    if (!collection?.entries) return [];
    const categories = collection.defaultRatingSystem?.categories || [];

    let list = collection.entries.map((entry: any) => {
      const media = entry.mediaItem;
      const userRating = ratingsMap[media.id];
      const ratingStatus = getItemRatingStatus(categories, userRating);
      const score = ratingStatus.score;
      return {
        ...entry,
        score,
        ratingStatus,
        userRating,
      };
    });

    // Filtering
    if (filterRated === "rated") {
      list = list.filter((e: any) => e.ratingStatus.state === "rated");
    } else if (filterRated === "in_progress") {
      list = list.filter((e: any) => e.ratingStatus.state === "in_progress");
    } else if (filterRated === "unrated") {
      list = list.filter((e: any) => e.ratingStatus.state === "unrated");
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
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Loading cinematic ranking...</p>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-display text-4xl uppercase text-foreground">Ranking Not Found</h2>
        <p className="text-sm text-muted-foreground">{error || "The requested collection could not be loaded."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-secondary hover:bg-surface text-foreground border border-border text-xs font-semibold transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Library</span>
        </Link>
      </div>
    );
  }

  const collectionTitle = collection.title || collection.name || "";
  const totalEntries = collection.entries?.length || 0;

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
        className="border-b border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-6">
          {/* Breadcrumb & Visibility row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Library</span>
            </Link>

            <div className="flex items-center gap-3">
              {isOwner && (
                <div className="flex items-center gap-1 p-1 rounded-md bg-card/90 border border-border">
                  <button
                    type="button"
                    onClick={() => handleVisibilityChange("private")}
                    disabled={visibilityUpdating}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      visibility === "private"
                        ? "bg-surface text-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                        ? "bg-surface text-primary"
                        : "text-muted-foreground hover:text-foreground"
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
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-card/80 hover:bg-card text-muted-foreground hover:text-primary border border-border transition-colors"
                title="Compare with another ranking"
              >
                <GitCompare size={12} className="text-primary" />
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-card/80 hover:bg-card text-muted-foreground hover:text-primary border border-border transition-colors cursor-pointer"
                    title="Customize ranking banner artwork"
                  >
                    <ImageIcon size={12} className="text-primary" />
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
              <span className="text-[11px] font-mono text-primary font-semibold">
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
              {/* Prototype Editorial Eyebrow */}
              <span className="text-[10px] text-primary font-semibold tracking-widest uppercase block mb-1">
                {collection.collectionType === "tv_show"
                  ? "The Episode Ranking"
                  : collection.collectionType === "movie_franchise"
                    ? "The Film Franchise"
                    : "Curated Canon"}
              </span>

              {/* Transparent ClearLOGO or Primary Typographic Heading (Never both) */}
              {collection.clearLogoUrl ? (
                <div className="py-1">
                  <img
                    src={collection.clearLogoUrl}
                    alt={collectionTitle}
                    className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)]"
                  />
                  <h1 className="sr-only">{collectionTitle}</h1>
                </div>
              ) : (
                <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tight text-foreground leading-[0.95] uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  {collectionTitle}
                </h1>
              )}

              {collection.description && (
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
                  {collection.description}
                </p>
              )}

              {/* Understated, Frosted Ranking Progress */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-card/75 backdrop-blur-md border border-border/70 space-y-2.5 max-w-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <span className="font-display text-base sm:text-lg font-bold text-foreground uppercase tracking-tight">
                    {completedCount} of {totalEntries} Rated{" "}
                    <span className="text-primary font-mono text-xs font-semibold ml-1">
                      ({completionPercentage}%)
                    </span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      <strong className="text-foreground font-semibold">{completedCount}</strong> rated
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-foreground font-semibold">{inProgressCount}</strong> partial
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-foreground font-semibold">{unratedCount}</strong> unrated
                    </span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="h-1.5 w-full rounded-full bg-surface/80 overflow-hidden flex border border-border/50">
                  <div
                    style={{ width: `${(completedCount / Math.max(1, totalEntries)) * 100}%` }}
                    className="h-full bg-primary transition-all duration-300"
                    title={`${completedCount} rated`}
                  />
                  <div
                    style={{ width: `${(inProgressCount / Math.max(1, totalEntries)) * 100}%` }}
                    className="h-full bg-amber-400/80 transition-all duration-300"
                    title={`${inProgressCount} in progress`}
                  />
                </div>
              </div>
            </div>

            {/* Frosted Glass Rubric Breakdown Panel */}
            <div className="lg:col-span-4 p-4 sm:p-5 rounded-xl bg-card/75 backdrop-blur-md border border-border/70 space-y-2.5 text-xs shadow-lg">
              <div className="flex justify-between items-center pb-2 border-b border-border font-semibold">
                <span className="font-display uppercase tracking-wider text-sm text-foreground">
                  {collection.defaultRatingSystem?.name || "Weighted Rubric"}
                </span>
                <span className="text-primary font-mono">
                  Scale 1–{collection.defaultRatingSystem?.scale || 10}
                </span>
              </div>

              {rubricCategories.length > 0 ? (
                rubricCategories.map((cat: any) => (
                  <div key={cat.id} className="flex justify-between text-muted-foreground">
                    <span>{cat.name}</span>
                    <span className="text-foreground font-bold">{cat.weight}x</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>Writing & Story</span><span className="text-foreground font-bold">8x</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Acting & Performance</span><span className="text-foreground font-bold">8x</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Cinematography</span><span className="text-foreground font-bold">7x</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Music & Sound Design</span><span className="text-foreground font-bold">3x</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Overall Impact</span><span className="text-primary font-bold">8x</span></div>
                </>
              )}

              {isOwner && collection.defaultRatingSystem && (
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleOpenRubricModal}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Sliders size={12} />
                    <span>Adjust Rubric Weights</span>
                  </button>
                  <Link
                    href="/settings"
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
          CONTROLS BAR (Season Filter, Rating Status Filter, View Modes, Sort)
          ========================================================================= */}
      <div className="sticky top-20 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          {/* Left: Action, Status Filters, & Season Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 rounded bg-secondary hover:bg-surface text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus size={13} />
                <span>Add Item</span>
              </button>
            )}

            {/* Rating Status Filters */}
            <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shrink-0">
              <button
                type="button"
                onClick={() => setFilterRated("all")}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  filterRated === "all"
                    ? "bg-surface text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({totalEntries})
              </button>
              <button
                type="button"
                onClick={() => setFilterRated("rated")}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  filterRated === "rated"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rated ({completedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterRated("in_progress")}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  filterRated === "in_progress"
                    ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                In Progress ({inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterRated("unrated")}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  filterRated === "unrated"
                    ? "bg-surface text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unrated ({unratedCount})
              </button>
            </div>

            {availableSeasons.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-border">
                <button
                  onClick={() => setSelectedSeason("all")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                    selectedSeason === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  All seasons
                </button>
                {availableSeasons.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSeason(s.toString())}
                    className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                      selectedSeason === s.toString()
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface"
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
              className="bg-surface text-xs text-foreground border border-input-border rounded px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="score_desc">Sort: Highest Score</option>
              <option value="order">Sort: Chronological</option>
              <option value="title">Sort: Alphabetical</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-card p-1 rounded border border-border">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-surface text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("editorial")}
                title="Grid view"
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === "editorial"
                    ? "bg-surface text-primary"
                    : "text-muted-foreground hover:text-foreground"
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
          <div className="text-center py-20 border border-dashed border-border rounded-xl space-y-3">
            <p className="text-sm text-muted-foreground">No items in this ranking collection.</p>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>Add Your First Item</span>
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-border border-t border-border">
            {processedEntries.map((entry: any, index: number) => {
              const media = entry.mediaItem;
              const { state, score, actionLabel, scoredCount, totalCategories } = entry.ratingStatus;
              const isMovie =
                media.mediaType === "movie" ||
                collection.collectionType === "movie_franchise" ||
                (!media.seasonNumber && Boolean(media.posterPath));

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 sm:gap-6 py-4 hover:bg-surface/40 px-2 sm:px-3 -mx-2 sm:-mx-3 rounded-lg transition-colors group"
                >
                  {/* Rank Numeral */}
                  <span className="w-8 sm:w-10 text-center font-display text-2xl sm:text-3xl font-bold text-muted-foreground/70 group-hover:text-primary transition-colors shrink-0">
                    {index < 9 ? `0${index + 1}` : index + 1}
                  </span>

                  {/* Cinematic Card: 2:3 Portrait for Movies, 16:9 for Episodes */}
                  <div className={isMovie ? "w-[72px] sm:w-[84px] shrink-0" : "w-28 sm:w-36 shrink-0"}>
                    <CinematicMediaCard
                      stillPath={media.stillPath}
                      posterPath={media.posterPath}
                      title={media.title}
                      aspect={isMovie ? "poster" : "video"}
                    />
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                      {media.seasonNumber && media.episodeNumber && (
                        <span>
                          Season {media.seasonNumber} · Episode {media.episodeNumber}
                        </span>
                      )}
                      {media.releaseDate && <span>· {media.releaseDate.split("-")[0]}</span>}
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground uppercase tracking-tight truncate mt-0.5 group-hover:text-primary transition-colors">
                      {media.title}
                    </h3>
                    {entry.userRating?.reviewText && (
                      <p className="text-xs text-muted-foreground line-clamp-1 italic mt-1">
                        &ldquo;{entry.userRating.reviewText}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Score & Rate Button */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <div className="text-right">
                      {state === "rated" && score !== null ? (
                        <div className="font-display text-2xl sm:text-3xl font-bold text-primary">
                          {score.toFixed(1)}
                          <span className="text-[11px] text-muted-foreground/70 ml-1 font-sans font-normal">/ 10</span>
                        </div>
                      ) : state === "in_progress" ? (
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 uppercase tracking-wider">
                            {scoredCount}/{totalCategories} Rated
                          </span>
                          {score !== null && (
                            <div className="font-display text-base font-bold text-amber-400/90 mt-0.5">
                              ★ {score.toFixed(1)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 font-medium">—</span>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedItemForRating(media)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        state === "rated"
                          ? "bg-surface hover:bg-surface-elevated text-foreground border-border"
                          : state === "in_progress"
                            ? "bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 border-amber-400/30"
                            : "bg-primary hover:bg-primary-hover text-primary-foreground border-primary shadow-sm"
                      }`}
                    >
                      <Sliders size={13} />
                      <span className="hidden sm:inline">{actionLabel}</span>
                      <span className="sm:hidden">{state === "rated" ? "Edit" : state === "in_progress" ? "Cont." : "Rate"}</span>
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setEntryToDelete(entry)}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
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
              const { state, score, actionLabel, scoredCount, totalCategories } = entry.ratingStatus;
              const isMovie =
                collection.collectionType === "movie_franchise" ||
                media.mediaType === "movie" ||
                !media.seasonNumber;

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border overflow-hidden flex flex-col justify-between group transition-colors ${
                    state === "rated"
                      ? "border-border bg-card hover:border-primary/50 shadow-sm"
                      : state === "in_progress"
                        ? "border-amber-500/30 bg-surface hover:border-amber-500/50"
                        : "border-border bg-surface/50 hover:border-border"
                  }`}
                >
                  <div className="relative overflow-hidden">
                    <CinematicMediaCard
                      stillPath={media.stillPath}
                      posterPath={media.posterPath}
                      title={media.title}
                      aspect={isMovie ? "poster" : "video"}
                    />
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md font-display text-lg text-white border border-white/10">
                      #{index < 9 ? `0${index + 1}` : index + 1}
                    </div>

                    {/* State Badge Top Right */}
                    {state === "rated" && score !== null ? (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-primary/40 text-primary font-display text-base shadow-lg">
                        ★ {score.toFixed(1)}
                      </div>
                    ) : state === "in_progress" ? (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-amber-500/50 text-amber-300 font-display text-xs tracking-wider uppercase font-bold shadow-lg">
                        {scoredCount}/{totalCategories} Rated
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-border text-muted-foreground text-[10px] uppercase font-semibold">
                        Unrated
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {media.seasonNumber ? `Season ${media.seasonNumber}, Ep ${media.episodeNumber}` : "Movie"}
                      </span>
                      <h3 className="font-display text-xl font-bold text-foreground uppercase tracking-tight mt-0.5 truncate">
                        {media.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setSelectedItemForRating(media)}
                        className={`flex-1 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          state === "rated"
                            ? "bg-secondary hover:bg-surface text-foreground border border-border"
                            : state === "in_progress"
                              ? "bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40"
                              : "bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm"
                        }`}
                      >
                        <Sliders size={13} />
                        <span>{actionLabel}</span>
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setEntryToDelete(entry)}
                          className="p-2 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-border hover:border-red-500/30 transition-colors cursor-pointer"
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
          <div className="w-full max-w-md rounded-xl bg-card border border-red-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                Delete Entire Ranking
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{collectionTitle}</strong>?
              This will remove all ranked entries and scores associated with this collection. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingCollection}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCollection}
                disabled={deletingCollection}
                className="px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <Trash2 className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-xl uppercase font-bold text-foreground">
                Remove Entry
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remove <strong className="text-foreground">{entryToDelete.mediaItem?.title}</strong> from this ranking?
              The item will be removed from this list, but your rating and TMDB metadata are preserved.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={deletingEntry}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveEntry}
                disabled={deletingEntry}
                className="px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingEntry ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
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
          <div className="w-full max-w-lg rounded-xl bg-card border border-border p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-foreground">
                  Adjust Rubric Weights
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calibrate the multiplier weights for each evaluation category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRubricModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {editingRubricCategories.map((cat, idx) => (
                <div
                  key={cat.id || idx}
                  className="p-3.5 rounded-lg border border-border bg-surface flex items-center justify-between gap-4"
                >
                  <span className="font-semibold text-xs text-foreground flex-1">
                    {cat.name}
                  </span>
                  <div className="w-44">
                    <CinematicSlider
                      min={0}
                      max={10}
                      step={0.5}
                      value={cat.weight}
                      onChange={(val) => {
                        setEditingRubricCategories((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, weight: val ?? 1 } : c))
                        );
                      }}
                      allowUnset={false}
                      showValue={true}
                      valueSuffix="x"
                      size="sm"
                      ariaLabel={`Weight for ${cat.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Scope Option */}
            <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customizeForCollectionOnly}
                  onChange={(e) => setCustomizeForCollectionOnly(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0 accent-primary"
                />
                <span className="text-xs font-semibold text-foreground">
                  Customize for this ranking only
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-6 leading-relaxed">
                {customizeForCollectionOnly
                  ? "Creates a dedicated rubric for this ranking so your other collections remain untouched."
                  : "Updates this rating system globally across all rankings that share it."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowRubricModal(false)}
                disabled={savingRubric}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRubric}
                disabled={savingRubric}
                className="px-5 py-2.5 rounded bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
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
          <div className="w-full max-w-xl rounded-xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-foreground">
                  {drilldownSeason
                    ? `${selectedTvShow?.name || "TV Show"} · ${drilldownSeason.name}`
                    : selectedTvShow
                      ? `${selectedTvShow.name || "TV Show"} · Seasons`
                      : "Add Entry to Ranking"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Seasons</span>
                </button>

                {loadingSeasonData ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={20} className="animate-spin text-primary" />
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
                          className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-16 h-10 bg-black/30 rounded overflow-hidden shrink-0 border border-border">
                              {ep.still_path ? (
                                <img
                                  src={getTmdbImageUrl(ep.still_path, "w300")}
                                  alt={ep.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                  Ep {ep.episode_number}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-foreground truncate">
                                Ep {ep.episode_number}: {ep.name}
                              </h4>
                              {ep.air_date && (
                                <span className="text-[10px] text-muted-foreground block mt-0.5">
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
                                ? "bg-surface text-muted-foreground border border-border cursor-not-allowed"
                                : "bg-secondary hover:bg-surface text-foreground border border-border"
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
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Search</span>
                </button>

                {loadingTvDetails ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <span>Loading seasons...</span>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {selectedTvShow.seasons
                      ?.filter((s: any) => s.season_number > 0)
                      .map((season: any) => (
                        <div
                          key={season.id}
                          className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-14 bg-black/30 rounded overflow-hidden shrink-0 border border-border">
                              {season.poster_path ? (
                                <img
                                  src={getTmdbImageUrl(season.poster_path, "w185")}
                                  alt={season.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                  S{season.season_number}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-foreground truncate">
                                {season.name}
                              </h4>
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                {season.episode_count} Episodes
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectSeason(season)}
                            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 bg-secondary hover:bg-surface text-foreground border border-border transition-all cursor-pointer shrink-0"
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies or TV shows (e.g. Alien, Severance)..."
                    autoFocus
                    className="w-full h-11 pl-9 pr-4 rounded-lg bg-surface border border-input-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                  {isSearchingTmdb && (
                    <Loader2
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin"
                    />
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearchingTmdb && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
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
                        className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-14 bg-black/30 rounded overflow-hidden shrink-0 border border-border">
                            {item.poster_path ? (
                              <img
                                src={getTmdbImageUrl(item.poster_path, "w185")}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-xs text-foreground truncate">
                              {title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              {year ? `${year} · ` : ""}{isTv ? "TV Series" : "Movie"}
                            </span>
                          </div>
                        </div>

                        {isTv ? (
                          <button
                            type="button"
                            onClick={() => handleSelectTvShow(item)}
                            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 bg-secondary hover:bg-surface text-foreground border border-border transition-all cursor-pointer shrink-0"
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
                                ? "bg-surface text-muted-foreground border border-border cursor-not-allowed"
                                : "bg-secondary hover:bg-surface text-foreground border border-border"
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
          <div className="w-full max-w-lg rounded-xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-xl uppercase font-bold text-foreground">
                  Ranking Header Banner
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload a custom backdrop image or specify an image URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Banner Preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Preview
              </label>
              <div className="aspect-[21/9] rounded-lg overflow-hidden bg-black/40 border border-border relative">
                {bannerUrlInput ? (
                  <img
                    src={bannerUrlInput}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
                    <ImageIcon size={20} className="text-muted-foreground/60" />
                    <span>No custom banner set (using default)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upload File */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
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
                  className="px-4 py-2 rounded bg-secondary hover:bg-surface text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
                    className="px-3 py-2 text-xs text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear Banner
                  </button>
                )}
              </div>
            </div>

            {/* Or Paste URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Or Image URL
              </label>
              <input
                type="url"
                value={bannerUrlInput}
                onChange={(e) => setBannerUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs rounded-lg px-3.5 py-2.5 bg-surface border border-input-border text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowBannerModal(false)}
                disabled={savingBanner}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBanner}
                disabled={savingBanner || bannerUploading}
                className="px-5 py-2.5 rounded bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
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
