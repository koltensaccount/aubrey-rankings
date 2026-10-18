"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { calculateWeightedAverage, CategoryDef, withSavedWeights } from "@/lib/scoring";
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
  const categories = !forceNewRubric ? withSavedWeights(ratingSystem?.categories || [],initialRating?.categoryScores ?? []) : ratingSystem?.categories || [];
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
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-dialog-title"
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
        if (e.key === "Escape" && !showClearConfirm) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-6 rounded-2xl bg-card border border-border text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Visual Still (Vivid artwork with localized lower fade) */}
        <div className="relative h-44 sm:h-52 w-full bg-card shrink-0 overflow-hidden">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={mediaItem.title}
              className="w-full h-full object-cover object-center opacity-90 dark:opacity-85 filter saturate-[0.95]"
            />
          ) : (
            <div className="w-full h-full bg-surface" />
          )}

          {/* Shorter localized bottom fade to transition into dialog surface */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/60 to-transparent pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-card/80 backdrop-blur-md text-foreground hover:bg-muted flex items-center justify-center border border-border transition-colors cursor-pointer z-10 shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header Title Metadata */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-4 z-10">
            <div className="space-y-1 min-w-0">
              {isEpisode && (
                <span className="inline-block px-2.5 py-0.5 rounded bg-card/90 backdrop-blur-sm border border-border text-[10px] text-primary font-semibold tracking-wider uppercase">
                  Season {mediaItem.seasonNumber} · Episode {mediaItem.episodeNumber}
                </span>
              )}
              <h2
                id="rating-dialog-title"
                className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
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

          {!forceNewRubric && initialRating?.ratingSystemId && collectionRatingSystem && initialRating.ratingSystemId !== collectionRatingSystem.id && (
            <div className="text-xs text-muted-foreground rounded-lg border border-border p-3 space-y-2">
              <p>This rating uses its original rubric, {ratingSystem?.name}. Your saved scores are preserved.</p>
              <button type="button" className="text-primary-text underline" onClick={() => {
                if (window.confirm("Use the collection's current rubric? Saving will replace this rating's old category scores. Other ratings will be preserved.")) { setScores({}); setForceNewRubric(true); }
              }}>Re-rate with the collection rubric</button>
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
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-semibold uppercase tracking-wider text-[11px]">
                <AlertTriangle size={14} />
                <span>Historical Rubric Transition</span>
              </div>
              <p className="text-foreground/80 leading-relaxed">
                This item was originally scored under a previous rubric (Overall:{" "}
                <strong className="text-amber-400">
                  ★ {initialRating?.calculatedOverallScore ? initialRating.calculatedOverallScore.toFixed(2) : "—"}
                </strong>
                ). The collection now uses &ldquo;{ratingSystem?.name || "Standard Rubric"}&rdquo;.
                Your historical score and review remain safely preserved.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMigrateMatchingCategories}
                  className="px-3 py-1.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles size={12} />
                  <span>Re-score with Current Rubric</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Scoring Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm sm:text-base font-bold text-foreground uppercase tracking-wide">
                  Category Scoring
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Scale 0–{scale}
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
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
                          ? "border-border bg-card shadow-sm"
                          : "border-border/60 bg-muted/30"
                      }`}
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {cat.name}
                          </span>
                          {cat.isRequired && (
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/80 px-1.5 py-0.5 rounded border border-border shrink-0">
                              Req
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {cat.weight}× weight
                          </span>

                          {/* Quick Reset / Unrate button */}
                          {isScored && (
                            <button
                              type="button"
                              onClick={() => handleScoreChange(cat.id, null)}
                              title="Clear category score"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                            min={0}
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
                            className="w-14 h-8 text-center text-xs font-semibold rounded-lg bg-input border border-input-border text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                          />
                        </div>
                      </div>

                      {/* Readout label */}
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-muted-foreground">
                          {isScored ? (
                            <span className="text-primary font-semibold">
                              {currentScore.toFixed(1)}{" "}
                              <span className="text-muted-foreground font-normal">/ {scale}</span>
                            </span>
                          ) : (
                            <span className="italic">Not rated</span>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground/75">
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
              className="w-full text-xs rounded-xl p-3 bg-input border border-input-border text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary leading-relaxed resize-none"
            />
          </div>

          {/* Metadata Toggles: Watched, Favorite & Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsWatched(!isWatched)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isWatched
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
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
                    ? "bg-red-500/10 border-red-500/30 text-red-500"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
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
                className="bg-input text-xs text-foreground border border-input-border rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* =========================================================================
              PROMINENT LIVE OVERALL SCORE CARD (Restrained, semantic, no crypto amber)
              ========================================================================= */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              scoredCount === 0
                ? "bg-muted/30 border-border text-muted-foreground"
                : isComplete
                  ? "bg-primary/10 border-primary/40 text-foreground"
                  : "bg-card border-border text-foreground shadow-sm"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                  {scoredCount === 0
                    ? "Your Overall Score · Unrated"
                    : isComplete
                      ? "Your Overall Score · Complete"
                      : `Your Overall Score · In Progress (${scoredCount}/${totalCategoriesCount})`}
                </span>

                <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
                  {scoredCount === 0 ? (
                    <span className="text-muted-foreground text-lg font-sans">No score yet</span>
                  ) : (
                    <span className="flex items-baseline gap-1">
                      <span className="text-primary font-bold">★ {calculation.weightedScore?.toFixed(2)}</span>
                      <span className="text-xs font-sans text-muted-foreground">/ {scale}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold block">
                  {scoredCount === 0 ? (
                    <span className="text-muted-foreground">Unrated</span>
                  ) : isComplete ? (
                    <span className="text-primary">All {totalCategoriesCount} Categories Rated</span>
                  ) : (
                    <span>{scoredCount} of {totalCategoriesCount} Categories Rated</span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {scoredCount === 0
                    ? "Interact with sliders above to begin scoring"
                    : isComplete
                      ? "All required categories completed · Ready to save"
                      : "Complete all required categories to finalize"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Rating Confirmation Banner / Modal */}
        {showClearConfirm && (
          <div className="p-4 bg-red-950/20 border-t border-red-500/30 space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold uppercase tracking-wider">
              <Trash2 size={14} />
              <span>Confirm Rating Removal</span>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed">
              Choose how you want to clear your rating for &ldquo;{mediaItem.title}&rdquo;:
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteClear(true)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer transition-colors"
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
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              scoredCount > 0
                ? "bg-primary hover:bg-primary-hover text-primary-foreground font-bold shadow-primary/20"
                : "bg-secondary hover:bg-muted text-secondary-foreground border border-border"
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
