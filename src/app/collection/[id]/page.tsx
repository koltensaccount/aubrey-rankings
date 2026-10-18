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
import { RatingDialog } from "@/components/rating-dialog";
import { CommentsSection } from "@/components/social/comments-section";
import { getItemRatingStatus } from "@/lib/scoring";
import { CollectionHeader } from "./components/collection-header";
import {
  CollectionToolbar,
  type SortOption,
  type FilterOption,
} from "./components/collection-toolbar";
import { CollectionEntryList } from "./components/collection-entry-list";
import {
  DeleteCollectionDialog,
  RemoveEntryDialog,
} from "./components/collection-delete-dialogs";
import { CollectionRubricDialog } from "./components/collection-rubric-dialog";
import { CollectionBannerDialog } from "./components/collection-banner-dialog";
import { CollectionAddEntryDialog } from "./components/collection-add-entry-dialog";
import { calibrateOklchTheme } from "@/lib/palette";

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
      const status = getItemRatingStatus(categories, ur, collection.defaultRatingSystem?.scale ?? 10);
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
      const ratingStatus = getItemRatingStatus(categories, userRating, collection.defaultRatingSystem?.scale ?? 10);
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
        return b.score / (b.ratingStatus.scoreScale ?? 10) - a.score / (a.ratingStatus.scoreScale ?? 10);
      } else if (sortBy === "score_asc") {
        if (a.score === null && b.score === null) return a.sortOrder - b.sortOrder;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return a.score / (a.ratingStatus.scoreScale ?? 10) - b.score / (b.ratingStatus.scoreScale ?? 10);
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
      {/* 1. Cinematic Header & Rubric Breakdown */}
      <CollectionHeader
        collection={collection}
        collectionTitle={collectionTitle}
        totalEntries={totalEntries}
        isOwner={isOwner}
        visibility={visibility}
        visibilityUpdating={visibilityUpdating}
        handleVisibilityChange={handleVisibilityChange}
        completedCount={completedCount}
        inProgressCount={inProgressCount}
        unratedCount={unratedCount}
        completionPercentage={completionPercentage}
        rubricCategories={rubricCategories}
        onOpenRubricModal={handleOpenRubricModal}
        onOpenBannerModal={() => {
          setBannerUrlInput(collection.backdropImage || "");
          setShowBannerModal(true);
        }}
        onOpenDeleteModal={() => setShowDeleteModal(true)}
      />

      {/* 2. Controls & Filter Bar */}
      <CollectionToolbar
        isOwner={isOwner}
        onOpenAddModal={() => setShowAddModal(true)}
        filterRated={filterRated}
        setFilterRated={setFilterRated}
        totalEntries={totalEntries}
        completedCount={completedCount}
        inProgressCount={inProgressCount}
        unratedCount={unratedCount}
        availableSeasons={availableSeasons}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* 3. Main Rankings Entries & Community Discussion */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <CollectionEntryList
          processedEntries={processedEntries}
          collection={collection}
          viewMode={viewMode}
          isOwner={isOwner}
          onOpenAddModal={() => setShowAddModal(true)}
          onSelectItemForRating={isOwner ? setSelectedItemForRating : () => {}}
          onSetEntryToDelete={setEntryToDelete}
        />

        <CommentsSection collectionId={collection.id} isOwner={isOwner} />
      </main>

      {/* 4. Modular Dialogs */}
      <DeleteCollectionDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCollection}
        collectionTitle={collectionTitle}
        isDeleting={deletingCollection}
      />

      <RemoveEntryDialog
        isOpen={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleRemoveEntry}
        entry={entryToDelete}
        isDeleting={deletingEntry}
      />

      <CollectionRubricDialog
        isOpen={showRubricModal}
        onClose={() => setShowRubricModal(false)}
        categories={editingRubricCategories}
        onCategoriesChange={setEditingRubricCategories}
        customizeForCollectionOnly={customizeForCollectionOnly}
        onCustomizeScopeChange={setCustomizeForCollectionOnly}
        onSave={handleSaveRubric}
        isSaving={savingRubric}
      />

      <CollectionBannerDialog
        isOpen={showBannerModal}
        onClose={() => setShowBannerModal(false)}
        bannerUrlInput={bannerUrlInput}
        onBannerUrlInputChange={setBannerUrlInput}
        bannerFileRef={bannerFileRef}
        onBannerUpload={handleBannerUpload}
        bannerUploading={bannerUploading}
        onSaveBanner={handleSaveBanner}
        savingBanner={savingBanner}
      />

      <CollectionAddEntryDialog
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSearchQuery("");
          setSearchResults([]);
          setSelectedTvShow(null);
          setDrilldownSeason(null);
        }}
        collection={collection}
        drilldownSeason={drilldownSeason}
        setDrilldownSeason={setDrilldownSeason}
        selectedTvShow={selectedTvShow}
        setSelectedTvShow={setSelectedTvShow}
        tvSeasonData={tvSeasonData}
        setTvSeasonData={setTvSeasonData}
        loadingSeasonData={loadingSeasonData}
        loadingTvDetails={loadingTvDetails}
        addingMediaId={addingMediaId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        isSearchingTmdb={isSearchingTmdb}
        handleAddTvEpisode={handleAddTvEpisode}
        handleSelectSeason={handleSelectSeason}
        handleSelectTvShow={handleSelectTvShow}
        handleAddTmdbItem={handleAddTmdbItem}
      />

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
