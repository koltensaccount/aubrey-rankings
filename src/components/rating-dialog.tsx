"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Eye,
  Heart,
  Save,
  Loader2,
  Sliders,
  Trash2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { calculateWeightedAverage, CategoryDef, withSavedWeights } from "@/lib/scoring";
import { RatingDialogHeader } from "@/components/rating/rating-dialog-header";
import { RatingCategorySlider } from "@/components/rating/rating-category-slider";
import { RatingScoreSummary } from "@/components/rating/rating-score-summary";
import { RatingClearDialog } from "@/components/rating/rating-clear-dialog";
import { RatingTierSelector } from "@/components/rating/rating-tier-selector";
import { TierItem } from "@/lib/tier-system";

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: any;
  collectionId?: string;
  ratingSystem: {
    id: string;
    name: string;
    scale?: number;
    type?: string;
    categories?: Array<{
      id: string;
      name: string;
      weight: number;
      isRequired: boolean;
    }>;
    tiers?: Array<TierItem>;
  } | null;
  initialRating?: any;
  onRatingSaved: (savedRating: any) => void;
}

export function RatingDialog({
  isOpen,
  onClose,
  mediaItem,
  collectionId,
  ratingSystem: collectionRatingSystem,
  initialRating,
  onRatingSaved,
}: RatingDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button")?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, [isOpen]);

  // Genuine unset state: scores[catId] is number | null
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isWatched, setIsWatched] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [watchDate, setWatchDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear confirmation modal state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Rubric mismatch state
  const [forceNewRubric, setForceNewRubric] = useState(false);

  const ratingSystem: RatingDialogProps["ratingSystem"] = !forceNewRubric && initialRating?.ratingSystem ? initialRating.ratingSystem : collectionRatingSystem;
  const isTier = ratingSystem?.type === "tier";
  const categories = !isTier && !forceNewRubric ? withSavedWeights(ratingSystem?.categories || [], initialRating?.categoryScores ?? []) : ratingSystem?.categories || [];
  const scale = ratingSystem?.scale || 10;

  // Initialize form state when item or initialRating changes
  useEffect(() => {
    if (initialRating) {
      const scoresMap: Record<string, number | null> = {};
      if (Array.isArray(initialRating.categoryScores)) {
        for (const cs of initialRating.categoryScores) {
          if (typeof cs.score === "number" && Number.isFinite(cs.score)) {
            scoresMap[cs.categoryId] = cs.score;
          }
        }
      }
      setScores(scoresMap);
      setSelectedTierId(initialRating.tierId ?? null);
      setReviewText(initialRating.reviewText || "");
      setPersonalNotes(initialRating.personalNotes || "");
      setIsWatched(initialRating.isWatched !== false);
      setIsFavorite(Boolean(initialRating.isFavorite));
      setWatchDate(
        initialRating.watchDate
          ? new Date(initialRating.watchDate).toISOString().split("T")[0]
          : ""
      );
      setForceNewRubric(false);
    } else {
      setScores({});
      setSelectedTierId(null);
      setReviewText("");
      setPersonalNotes("");
      setIsWatched(true);
      setIsFavorite(false);
      setWatchDate(new Date().toISOString().split("T")[0]);
      setForceNewRubric(false);
    }
    setShowClearConfirm(false);
    setError(null);
  }, [initialRating, mediaItem, isOpen]);

  // Check for mismatched historical category IDs
  const historicalScores = useMemo(() => {
    if (!initialRating || !Array.isArray(initialRating.categoryScores)) return [];
    return initialRating.categoryScores.filter(
      (cs: any) => typeof cs.score === "number" && Number.isFinite(cs.score)
    );
  }, [initialRating]);

  const hasMismatchedSystem = useMemo(() => {
    if (historicalScores.length === 0 || forceNewRubric) return false;
    const currentCategoryIds = new Set(categories.map((c) => c.id));
    return historicalScores.some((cs: any) => !currentCategoryIds.has(cs.categoryId));
  }, [historicalScores, categories, forceNewRubric]);

  if (!isOpen || !mediaItem) return null;

  // Build category definitions
  const categoryDefs: CategoryDef[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight,
    isRequired: c.isRequired,
  }));

  // Build clean numeric scores map for calculation
  const numericScoresForCalc: Record<string, number | null> = {};
  for (const cat of categories) {
    const val = scores[cat.id];
    numericScoresForCalc[cat.id] =
      typeof val === "number" && Number.isFinite(val) ? val : null;
  }

  const calculation = calculateWeightedAverage(categoryDefs, numericScoresForCalc);

  // Score change handler
  const handleScoreChange = (catId: string, val: number | null) => {
    setScores((prev) => ({
      ...prev,
      [catId]: val !== null && !isNaN(val) ? Math.max(0, Math.min(scale, val)) : null,
    }));
  };

  // Numeric input change handler (synchronizes with slider)
  const handleNumericInputChange = (catId: string, text: string) => {
    if (text.trim() === "") {
      handleScoreChange(catId, null);
      return;
    }
    const num = parseFloat(text);
    if (!isNaN(num) && num >= 0 && num <= scale) {
      handleScoreChange(catId, num);
    }
  };

  // Convert/Migrate matching categories
  const handleMigrateMatchingCategories = () => {
    const newScores: Record<string, number | null> = {};
    for (const cat of categories) {
      const matched = historicalScores.find((hs: any) => {
        const hsName = hs.categoryName || hs.name;
        return hsName && hsName.toLowerCase() === cat.name.toLowerCase();
      });
      if (matched && typeof matched.score === "number") {
        newScores[cat.id] = matched.score;
      }
    }
    setScores(newScores);
    setForceNewRubric(true);
  };

  // Clear rating handler
  const handleExecuteClear = async (clearScoresOnly: boolean) => {
    if (!initialRating) return;
    setError(null);
    setDeleting(true);

    try {
      const query = new URLSearchParams();
      query.set("mediaItemId", mediaItem.id);
      if (collectionId) {
        query.set("collectionId", collectionId);
      }
      if (clearScoresOnly) {
        if (isTier) {
          query.set("clearTierOnly", "true");
        } else {
          query.set("clearScoresOnly", "true");
        }
      }

      const res = await fetch(`/api/ratings?${query.toString()}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear rating");
      }

      if (clearScoresOnly) {
        if (isTier) {
          setSelectedTierId(null);
          onRatingSaved({
            ...initialRating,
            tierId: null,
            clearedTierOnly: true,
          });
        } else {
          setScores({});
          onRatingSaved({
            ...initialRating,
            calculatedOverallScore: null,
            categoryScores: [],
            clearedScoresOnly: true,
          });
        }
      } else {
        onRatingSaved({
          mediaItemId: mediaItem.id,
          cleared: true,
        });
        onClose();
      }
      setShowClearConfirm(false);
    } catch (err: any) {
      setError(err?.message || "Failed to clear rating");
    } finally {
      setDeleting(false);
    }
  };

  // Save rating handler
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const isUpdatingScores = !hasMismatchedSystem;
      let categoryScoresArray: Array<{ categoryId: string; score: number }> = [];
      let numericScoresMap: Record<string, number | null> = {};

      if (!isTier && isUpdatingScores) {
        numericScoresMap = Object.fromEntries(categories.map((c) => [c.id, null]));
        for (const [catId, score] of Object.entries(scores)) {
          if (score !== null && typeof score === "number" && Number.isFinite(score)) {
            numericScoresMap[catId] = score;
            categoryScoresArray.push({
              categoryId: catId,
              score,
            });
          }
        }
      }

      const payload: any = {
        mediaItemId: mediaItem.id,
        collectionId: collectionId || null,
        watchDate: watchDate ? new Date(watchDate).toISOString() : null,
        reviewText: reviewText.trim() || null,
        personalNotes: personalNotes.trim() || null,
        isWatched,
        isFavorite,
      };

      if (isTier) {
        payload.ratingSystemId = ratingSystem?.id || null;
        payload.tierId = selectedTierId;
      } else if (isUpdatingScores) {
        payload.ratingSystemId = ratingSystem?.id || null;
        payload.scores = numericScoresMap;
        payload.categoryScores = categoryScoresArray;
        if (forceNewRubric) payload.replaceRatingSystem = true;
      }

      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save rating");
      }

      const savedData = await res.json();
      onRatingSaved(
        savedData.rating || {
          mediaItemId: mediaItem.id,
          tierId: isTier ? selectedTierId : initialRating?.tierId ?? null,
          calculatedOverallScore: !isTier && isUpdatingScores
            ? calculation.weightedScore
            : initialRating?.calculatedOverallScore ?? null,
          categoryScores: !isTier && isUpdatingScores
            ? categoryScoresArray
            : initialRating?.categoryScores ?? [],
          reviewText: reviewText.trim() || null,
          personalNotes: personalNotes.trim() || null,
          isWatched,
          isFavorite,
        }
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const backdropUrl = mediaItem.stillPath
    ? getTmdbImageUrl(mediaItem.stillPath, "original")
    : mediaItem.backdropPath
      ? getTmdbImageUrl(mediaItem.backdropPath, "original")
      : null;

  const isEpisode = Boolean(mediaItem.seasonNumber && mediaItem.episodeNumber);
  const totalCategoriesCount = categories.length;
  const scoredCount = calculation.totalScoredCategories;
  const isComplete = calculation.isComplete;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-dialog-title"
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const controls = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
            ) ?? []
          ).filter((el) => el.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
        if (e.key === "Escape" && !showClearConfirm) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-6 rounded-dialog bg-card border border-border-dialog text-foreground shadow-dialog overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Visual Still */}
        <RatingDialogHeader
          title={mediaItem.title}
          backdropUrl={backdropUrl}
          isEpisode={isEpisode}
          seasonNumber={mediaItem.seasonNumber}
          episodeNumber={mediaItem.episodeNumber}
          onClose={onClose}
        />

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-card bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!forceNewRubric &&
            initialRating?.ratingSystemId &&
            collectionRatingSystem &&
            initialRating.ratingSystemId !== collectionRatingSystem.id && (
              <div className="text-xs text-muted-foreground rounded-card border border-border p-3 space-y-2">
                <p>
                  This rating uses its original rubric, {ratingSystem?.name}. Your saved scores are
                  preserved.
                </p>
                <button
                  type="button"
                  className="text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Use the collection's current rubric? Saving will replace this rating's old category scores. Other ratings will be preserved."
                      )
                    ) {
                      setScores({});
                      setForceNewRubric(true);
                    }
                  }}
                >
                  Re-rate with the collection rubric
                </button>
              </div>
            )}

          {/* Overview snippet if available */}
          {mediaItem.overview && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {mediaItem.overview}
            </p>
          )}

          {/* Mismatched Rubric Notice */}
          {hasMismatchedSystem && (
            <div className="p-4 rounded-card bg-surface border border-border space-y-2 text-xs">
              <div className="flex items-center gap-2 text-primary-text font-semibold uppercase tracking-wider text-[11px]">
                <AlertTriangle size={14} />
                <span>Historical Rubric Transition</span>
              </div>
              <p className="text-foreground/80 leading-relaxed">
                This item was originally scored under a previous rubric (Overall:{" "}
                <strong className="text-primary-text">
                  ★{" "}
                  {initialRating?.calculatedOverallScore
                    ? initialRating.calculatedOverallScore.toFixed(2)
                    : "—"}
                </strong>
                ). The collection now uses &ldquo;
                {ratingSystem?.name || "Standard Rubric"}&rdquo;. Your historical score and review
                remain safely preserved.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMigrateMatchingCategories}
                  className="px-3 py-1.5 rounded-button bg-primary/15 hover:bg-primary/25 text-primary-text border border-primary/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles size={12} />
                  <span>Re-score with Current Rubric</span>
                </button>
              </div>
            </div>
          )}

          {/* Tier or Category Scoring Section */}
          {isTier ? (
            <RatingTierSelector
              tiers={ratingSystem?.tiers || []}
              selectedTierId={selectedTierId}
              onSelectTier={setSelectedTierId}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm sm:text-base font-bold text-foreground uppercase tracking-wide">
                    Category Scoring
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">Scale 0–{scale}</span>
              </div>

              {categories.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-card">
                  No scoring categories configured for this rubric.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {categories.map((cat) => (
                    <RatingCategorySlider
                      key={cat.id}
                      category={cat}
                      score={scores[cat.id] ?? null}
                      scale={scale}
                      onScoreChange={handleScoreChange}
                      onNumericInputChange={handleNumericInputChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Critique & Reflections
            </label>
            <textarea
              rows={3}
              placeholder={
                isEpisode
                  ? "What made this episode resonant, terrifying, or profound?"
                  : "Critique, reflections, or highlights on this title..."
              }
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full text-xs rounded-input p-3 bg-surface border border-border-input text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary leading-relaxed resize-none"
            />
          </div>

          {/* Metadata Toggles: Watched, Favorite & Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsWatched(!isWatched)}
                className={`px-3 py-1.5 rounded-button border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isWatched
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-surface-elevated border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye size={13} />
                <span>{isWatched ? "Watched" : "Unwatched"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`px-3 py-1.5 rounded-button border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isFavorite
                    ? "bg-red-500/10 border-red-500/30 text-red-500"
                    : "bg-surface-elevated border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart size={13} className={isFavorite ? "fill-red-500" : ""} />
                <span>Favorite</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-muted-foreground" />
              <input
                type="date"
                value={watchDate}
                onChange={(e) => setWatchDate(e.target.value)}
                className="bg-surface text-xs text-foreground border border-border-input rounded-input px-2.5 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Prominent Live Overall Score Card */}
          {!isTier && (
            <RatingScoreSummary
              scoredCount={scoredCount}
              totalCategoriesCount={totalCategoriesCount}
              isComplete={isComplete}
              weightedScore={calculation.weightedScore}
              scale={scale}
            />
          )}
        </div>

        {/* Clear Rating Confirmation Banner */}
        {showClearConfirm && (
          <RatingClearDialog
            mediaTitle={mediaItem.title}
            deleting={deleting}
            onCancel={() => setShowClearConfirm(false)}
            onClearScoresOnly={() => handleExecuteClear(true)}
            onDeleteEntireRating={() => handleExecuteClear(false)}
          />
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-border bg-card/60 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {initialRating && !showClearConfirm && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={deleting || saving}
                className="px-3 py-1.5 rounded-button text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Options to clear scores or remove entire rating"
              >
                <Trash2 size={13} />
                <span>Clear Rating...</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className={`px-5 py-2.5 rounded-button text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              isTier
                ? selectedTierId
                  ? "bg-primary hover:bg-primary-hover text-primary-foreground font-bold shadow-primary/20"
                  : "bg-surface-elevated hover:bg-muted text-foreground border border-border"
                : scoredCount > 0
                  ? "bg-primary hover:bg-primary-hover text-primary-foreground font-bold shadow-primary/20"
                  : "bg-surface-elevated hover:bg-muted text-foreground border border-border"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>
                  {isTier
                    ? selectedTierId
                      ? "Save Tier Assignment"
                      : "Save"
                    : isComplete
                      ? "Save Rating"
                      : scoredCount > 0
                        ? "Save Progress"
                        : "Save"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
