"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Star,
  Check,
  Calendar,
  Eye,
  Heart,
  Save,
  Loader2,
  Sliders,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { calculateWeightedAverage, CategoryDef } from "@/lib/scoring";
import { CinematicSlider } from "@/components/cinematic-slider";

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: any;
  collectionId?: string;
  ratingSystem: {
    id: string;
    name: string;
    scale: number;
    categories: Array<{
      id: string;
      name: string;
      weight: number;
      isRequired: boolean;
    }>;
  } | null;
  initialRating?: any;
  onRatingSaved: (savedRating: any) => void;
}

export function RatingDialog({
  isOpen,
  onClose,
  mediaItem,
  collectionId,
  ratingSystem,
  initialRating,
  onRatingSaved,
}: RatingDialogProps) {
  // Genuine unset state: scores[catId] is number | null
  const [scores, setScores] = useState<Record<string, number | null>>({});
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

  const categories = ratingSystem?.categories || [];
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
      // Find historical score by matching category name (case-insensitive)
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
        query.set("clearScoresOnly", "true");
      }

      const res = await fetch(`/api/ratings?${query.toString()}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear rating");
      }

      if (clearScoresOnly) {
        // Reset scores locally without destroying review
        setScores({});
        onRatingSaved({
          ...initialRating,
          calculatedOverallScore: null,
          categoryScores: [],
          clearedScoresOnly: true,
        });
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
      // If user has historical mismatched rating and did NOT opt to re-rate,
      // save only review/notes/status non-destructively!
      const isUpdatingScores = !hasMismatchedSystem;

      let categoryScoresArray: Array<{ categoryId: string; score: number }> = [];
      let numericScoresMap: Record<string, number | null> = {};

      if (isUpdatingScores) {
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

      if (isUpdatingScores) {
        payload.ratingSystemId = ratingSystem?.id || null;
        payload.scores = numericScoresMap;
        payload.categoryScores = categoryScoresArray;
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
          calculatedOverallScore: isUpdatingScores
            ? calculation.weightedScore
            : initialRating?.calculatedOverallScore ?? null,
          categoryScores: isUpdatingScores
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-dialog-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !showClearConfirm) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-6 rounded-2xl bg-[#141a17] border border-[#303b34] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Visual Still */}
        <div className="relative h-44 sm:h-52 w-full bg-black shrink-0">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={mediaItem.title}
              className="w-full h-full object-cover object-center opacity-65 filter saturate-90"
            />
          ) : (
            <div className="w-full h-full bg-[#111514]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141a17] via-[#141a17]/60 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/75 backdrop-blur-md text-[#f1f0e9] hover:bg-[#25342c] flex items-center justify-center border border-[#303b34] transition-colors cursor-pointer z-10"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header Title Metadata */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {isEpisode && (
                <span className="inline-block px-2.5 py-0.5 rounded bg-black/80 border border-[#303b34] text-[10px] text-[#89d5d5] font-semibold tracking-wider uppercase">
                  Season {mediaItem.seasonNumber} · Episode {mediaItem.episodeNumber}
                </span>
              )}
              <h2
                id="rating-dialog-title"
                className="font-display text-2xl sm:text-3xl font-bold text-[#f1f0e9] uppercase tracking-tight truncate drop-shadow-md"
              >
                {mediaItem.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Overview snippet if available */}
          {mediaItem.overview && (
            <p className="text-xs text-[#9aa79e] leading-relaxed line-clamp-2">
              {mediaItem.overview}
            </p>
          )}

          {/* Mismatched Rubric Notice */}
          {hasMismatchedSystem && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-semibold uppercase tracking-wider text-[11px]">
                <AlertTriangle size={14} />
                <span>Historical Rubric Transition</span>
              </div>
              <p className="text-[#c7d5cb] leading-relaxed">
                This item was originally scored under a previous rubric (Overall:{" "}
                <strong className="text-amber-300">
                  ★ {initialRating?.calculatedOverallScore ? initialRating.calculatedOverallScore.toFixed(2) : "—"}
                </strong>
                ). The collection now uses &ldquo;{ratingSystem?.name || "Standard Rubric"}&rdquo;.
                Your historical score and review remain safely preserved.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMigrateMatchingCategories}
                  className="px-3 py-1.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles size={12} />
                  <span>Re-score with Current Rubric</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Scoring Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#28342d] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#89d5d5]" />
                <h3 className="font-display text-sm sm:text-base font-bold text-[#f1f0e9] uppercase tracking-wide">
                  Category Scoring
                </h3>
              </div>
              <span className="text-xs text-[#8fa095] font-mono">
                Scale 1–{scale}
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8fa095] border border-dashed border-[#2b3730] rounded-xl">
                No scoring categories configured for this rubric.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {categories.map((cat) => {
                  const currentScore = scores[cat.id];
                  const isScored = typeof currentScore === "number" && Number.isFinite(currentScore);

                  return (
                    <div
                      key={cat.id}
                      className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                        isScored
                          ? "border-[#3b4c40] bg-[#141b18]"
                          : "border-[#253229] bg-[#111613]"
                      }`}
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-[#f1f0e9] truncate">
                            {cat.name}
                          </span>
                          {cat.isRequired && (
                            <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20 shrink-0">
                              Req
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-[#89d5d5] font-semibold bg-[#89d5d5]/10 px-1.5 py-0.5 rounded border border-[#89d5d5]/20">
                            {cat.weight}× weight
                          </span>

                          {/* Quick Reset / Unrate button */}
                          {isScored && (
                            <button
                              type="button"
                              onClick={() => handleScoreChange(cat.id, null)}
                              title="Clear category score"
                              className="p-1 rounded text-[#6c7d73] hover:text-[#f1f0e9] hover:bg-[#25342c] transition-colors cursor-pointer"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Slider and Synchronized Numeric Input */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <CinematicSlider
                            value={currentScore ?? null}
                            onChange={(val) => handleScoreChange(cat.id, val)}
                            min={1}
                            max={scale}
                            step={0.5}
                            name={cat.name}
                            ariaLabel={`${cat.name} score`}
                          />
                        </div>

                        {/* Numeric Input */}
                        <div className="shrink-0 flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={scale}
                            step="0.1"
                            placeholder="—"
                            value={isScored ? currentScore : ""}
                            onChange={(e) => handleNumericInputChange(cat.id, e.target.value)}
                            aria-label={`${cat.name} numeric score`}
                            className="w-14 h-8 text-center text-xs font-semibold rounded-lg bg-[#18211d] border border-[#3b4c40] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] transition-colors"
                          />
                        </div>
                      </div>

                      {/* Readout label */}
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-[#6c7d73]">
                          {isScored ? (
                            <span className="text-[#89d5d5] font-semibold">
                              {currentScore.toFixed(1)}{" "}
                              <span className="text-[#6c7d73] font-normal">/ {scale}</span>
                            </span>
                          ) : (
                            <span className="italic">Not rated</span>
                          )}
                        </span>
                        <span className="text-[10px] text-[#55675c]">
                          max {scale}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8fa095] uppercase tracking-wider block">
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
              className="w-full text-xs rounded-xl p-3 bg-[#111613] border border-[#2b3730] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] leading-relaxed resize-none"
            />
          </div>

          {/* Metadata Toggles: Watched, Favorite & Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#28342d] text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsWatched(!isWatched)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isWatched
                    ? "bg-[#1c2721] border-[#3b4c40] text-[#89d5d5]"
                    : "bg-[#141a17] border-[#2b3730] text-[#6c7d73]"
                }`}
              >
                <Eye size={13} />
                <span>{isWatched ? "Watched" : "Unwatched"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isFavorite
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-[#141a17] border-[#2b3730] text-[#6c7d73]"
                }`}
              >
                <Heart size={13} className={isFavorite ? "fill-red-400" : ""} />
                <span>Favorite</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-[#6c7d73]" />
              <input
                type="date"
                value={watchDate}
                onChange={(e) => setWatchDate(e.target.value)}
                className="bg-[#18211d] text-xs text-[#f1f0e9] border border-[#2b3730] rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#89d5d5]"
              />
            </div>
          </div>

          {/* =========================================================================
              PROMINENT LIVE OVERALL SCORE CARD (Requirement 3: Right above Save action)
              ========================================================================= */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              scoredCount === 0
                ? "bg-[#121714] border-[#253229] text-[#6c7d73]"
                : isComplete
                  ? "bg-[#89d5d5]/10 border-[#89d5d5]/40 text-[#89d5d5]"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-85">
                  {scoredCount === 0
                    ? "Your Overall Score"
                    : isComplete
                      ? "Your Overall Score"
                      : "Your Overall Score · Provisional"}
                </span>

                <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
                  {scoredCount === 0 ? (
                    <span className="text-[#8fa095] text-lg font-sans">No score yet</span>
                  ) : (
                    <span>
                      ★ {calculation.weightedScore?.toFixed(2)}{" "}
                      <span className="text-xs font-sans opacity-70">/ {scale}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-xs font-medium block">
                  {scoredCount} of {totalCategoriesCount} categories rated
                </span>
                <span className="text-[10px] opacity-75 block mt-0.5">
                  {scoredCount === 0
                    ? "Interact with sliders above to begin scoring"
                    : isComplete
                      ? "All required categories completed"
                      : "Complete all required categories to finalize"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Rating Confirmation Banner / Modal */}
        {showClearConfirm && (
          <div className="p-4 bg-[#1b1515] border-t border-red-500/30 space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-red-300 text-xs font-semibold uppercase tracking-wider">
              <Trash2 size={14} />
              <span>Confirm Rating Removal</span>
            </div>
            <p className="text-xs text-[#d6c7c7] leading-relaxed">
              Choose how you want to clear your rating for &ldquo;{mediaItem.title}&rdquo;:
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-[#9aa79e] hover:text-[#f1f0e9] cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteClear(true)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2b2020] hover:bg-[#3d2c2c] text-amber-300 border border-amber-500/30 cursor-pointer transition-colors"
                >
                  Clear Scores Only (Keep Review & Notes)
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteClear(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 cursor-pointer transition-colors"
                >
                  Delete Entire Rating
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-[#28342d] bg-[#101412] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {initialRating && !showClearConfirm && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={deleting || saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Options to clear numerical scores or remove entire rating"
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
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
              isComplete
                ? "bg-[#89d5d5] hover:bg-[#a2e6e6] text-[#0d1714] font-bold shadow-[#89d5d5]/20"
                : scoredCount > 0
                  ? "bg-amber-400 hover:bg-amber-300 text-[#1b1509] font-bold shadow-amber-400/20"
                  : "bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523]"
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
                  {isComplete
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
