"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { calculateWeightedAverage, CategoryDef } from "@/lib/scoring";

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
  const [scores, setScores] = useState<Record<string, number | "">>({});
  const [reviewText, setReviewText] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isWatched, setIsWatched] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [watchDate, setWatchDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when item or initialRating changes
  useEffect(() => {
    if (initialRating) {
      const scoresMap: Record<string, number> = {};
      if (Array.isArray(initialRating.categoryScores)) {
        for (const cs of initialRating.categoryScores) {
          scoresMap[cs.categoryId] = cs.score;
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
    } else {
      setScores({});
      setReviewText("");
      setPersonalNotes("");
      setIsWatched(true);
      setIsFavorite(false);
      setWatchDate(new Date().toISOString().split("T")[0]);
    }
  }, [initialRating, mediaItem]);

  if (!isOpen || !mediaItem) return null;

  const categories = ratingSystem?.categories || [];
  const scale = ratingSystem?.scale || 10;

  // Calculate live weighted score
  const numericScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (v !== "" && typeof v === "number") {
      numericScores[k] = v;
    }
  }

  const calculation = calculateWeightedAverage(categories, numericScores);

  const handleScoreChange = (categoryId: string, val: string) => {
    if (val === "") {
      setScores((prev) => ({ ...prev, [categoryId]: "" }));
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(scale, num));
      setScores((prev) => ({ ...prev, [categoryId]: clamped }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        mediaItemId: mediaItem.id,
        collectionId: collectionId || null,
        ratingSystemId: ratingSystem?.id || null,
        scores: numericScores,
        watchDate: watchDate ? new Date(watchDate).toISOString() : null,
        reviewText: reviewText.trim() || null,
        personalNotes: personalNotes.trim() || null,
        isWatched,
        isFavorite,
      };

      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save rating");
      }

      onRatingSaved({
        id: data.ratingId,
        mediaItemId: mediaItem.id,
        calculatedOverallScore: data.calculatedOverallScore,
        isWatched,
        isFavorite,
        reviewText,
        personalNotes,
        watchDate,
        categoryScores: Object.entries(numericScores).map(([catId, sc]) => ({
          categoryId: catId,
          score: sc,
        })),
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save rating");
    } finally {
      setSaving(false);
    }
  };

  const artworkUrl = getTmdbImageUrl(
    mediaItem.stillPath || mediaItem.posterPath || mediaItem.backdropPath,
    "original"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header / Hero */}
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
          <img
            src={artworkUrl}
            alt={mediaItem.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center border border-white/10"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="space-y-1">
              {mediaItem.seasonNumber && mediaItem.episodeNumber && (
                <Badge variant="secondary" className="bg-black/60 text-xs text-amber-300">
                  Season {mediaItem.seasonNumber} &bull; Episode {mediaItem.episodeNumber}
                </Badge>
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {mediaItem.title}
              </h2>
            </div>

            {/* Calculated Weighted Score Live Pill */}
            {calculation.weightedScore !== null && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Weighted Score
                </span>
                <Badge variant="score" className="text-base px-3 py-1 shadow-lg">
                  ★ {calculation.weightedScore.toFixed(2)}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Media Overview */}
          {mediaItem.overview && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {mediaItem.overview}
            </p>
          )}

          {/* Weighted Categories Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Category Scoring</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Scale 1–{scale}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const currentScore = scores[cat.id];
                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-xl border border-border/70 bg-secondary/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-amber-400/80 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded">
                        Weight: {cat.weight}x
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max={scale}
                        step="0.5"
                        value={currentScore === "" || currentScore === undefined ? 0 : currentScore}
                        onChange={(e) => handleScoreChange(cat.id, e.target.value)}
                        className="flex-1 accent-amber-500 cursor-pointer"
                      />
                      <Input
                        type="number"
                        min="0"
                        max={scale}
                        step="0.1"
                        placeholder="—"
                        value={currentScore === "" || currentScore === undefined ? "" : currentScore}
                        onChange={(e) => handleScoreChange(cat.id, e.target.value)}
                        className="w-16 h-8 text-center text-sm font-bold bg-background text-amber-300 border-border"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Watch Date
              </label>
              <Input
                type="date"
                value={watchDate}
                onChange={(e) => setWatchDate(e.target.value)}
                className="h-9 text-xs bg-secondary/40"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <button
                type="button"
                onClick={() => setIsWatched(!isWatched)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  isWatched
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                <Eye className="h-4 w-4" />
                <span>Watched</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  isFavorite
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? "fill-amber-400" : ""}`} />
                <span>Favorite</span>
              </button>
            </div>
          </div>

          {/* Review & Personal Notes */}
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Review (Public / Displayed)
              </label>
              <textarea
                rows={2}
                placeholder="What did you think of this entry?"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full rounded-lg border border-border bg-input/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/80 resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Personal Notes (Private)
              </label>
              <textarea
                rows={2}
                placeholder="Private reminders, favorite quotes, or rewatch impressions..."
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-input/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/80 resize-none"
              />
            </div>
          </div>

          {/* Save Action */}
          <div className="flex items-center justify-between pt-4 border-t border-border/80">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="font-bold gap-2 shadow-lg shadow-amber-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Rating
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
