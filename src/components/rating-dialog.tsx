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

  const categoryDefs: CategoryDef[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight,
    isRequired: c.isRequired,
  }));

  const calculation = calculateWeightedAverage(categoryDefs, numericScores);

  const handleScoreChange = (catId: string, val: string) => {
    if (val === "") {
      setScores((prev) => ({ ...prev, [catId]: "" }));
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= scale) {
      setScores((prev) => ({ ...prev, [catId]: num }));
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Build category scores array
      const categoryScoresArray = Object.entries(scores)
        .filter(([_, score]) => score !== "" && typeof score === "number")
        .map(([categoryId, score]) => ({
          categoryId,
          score: score as number,
        }));

      const payload = {
        mediaItemId: mediaItem.id,
        collectionId: collectionId || null,
        ratingSystemId: ratingSystem?.id || null,
        categoryScores: categoryScoresArray,
        reviewText: reviewText.trim() || null,
        personalNotes: personalNotes.trim() || null,
        isWatched,
        isFavorite,
        watchDate: watchDate ? new Date(watchDate).toISOString() : null,
      };

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
      onRatingSaved(savedData);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-xl bg-[#141a17] border border-[#303b34] shadow-2xl overflow-hidden">
        {/* Header with Visual Still */}
        <div className="relative h-48 sm:h-56 w-full bg-black">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={mediaItem.title}
              className="w-full h-full object-cover object-center opacity-70"
            />
          ) : (
            <div className="w-full h-full bg-[#111514]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141a17] via-[#141a17]/50 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/70 backdrop-blur-md text-[#f1f0e9] hover:bg-[#25342c] flex items-center justify-center border border-[#303b34] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="space-y-1">
              {mediaItem.seasonNumber && mediaItem.episodeNumber && (
                <span className="inline-block px-2 py-0.5 rounded bg-black/75 border border-[#303b34] text-[10px] text-[#89d5d5] font-semibold">
                  Season {mediaItem.seasonNumber} · Episode {mediaItem.episodeNumber}
                </span>
              )}
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#f1f0e9] uppercase tracking-tight">
                {mediaItem.title}
              </h2>
            </div>

            {/* Calculated Weighted Score Live Pill */}
            {calculation.weightedScore !== null && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[#8fa095] uppercase font-semibold">
                  Overall Score
                </span>
                <span className="text-xl font-bold text-[#89d5d5] font-display">
                  ★ {calculation.weightedScore.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Media Overview */}
          {mediaItem.overview && (
            <p className="text-xs text-[#9aa79e] leading-relaxed line-clamp-3">
              {mediaItem.overview}
            </p>
          )}

          {/* Weighted Categories Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#28342d] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#89d5d5]" />
                <h3 className="font-display text-base font-bold text-[#f1f0e9] uppercase">
                  Category Scoring
                </h3>
              </div>
              <span className="text-xs text-[#8fa095]">
                Scale 1–{scale}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const currentScore = scores[cat.id];
                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-lg border border-[#2b3730] bg-[#111613] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#f1f0e9]">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-[#89d5d5] font-medium bg-[#89d5d5]/10 px-1.5 py-0.5 rounded border border-[#89d5d5]/20">
                        {cat.weight}x
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max={scale}
                        step="0.5"
                        value={typeof currentScore === "number" ? currentScore : scale / 2}
                        onChange={(e) => handleScoreChange(cat.id, e.target.value)}
                        className="flex-1 accent-[#89d5d5] cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max={scale}
                        step="0.1"
                        placeholder="—"
                        value={currentScore ?? ""}
                        onChange={(e) => handleScoreChange(cat.id, e.target.value)}
                        className="w-16 h-8 text-center text-xs font-semibold rounded bg-[#18211d] border border-[#3b4c40] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8fa095] uppercase tracking-wider block">
              Critique / Review
            </label>
            <textarea
              rows={3}
              placeholder="What made this episode resonant, terrifying, or profound?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full text-xs rounded-lg p-3 bg-[#111613] border border-[#2b3730] text-[#f1f0e9] focus:outline-none focus:border-[#89d5d5] leading-relaxed resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#28342d]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#9aa79e] hover:text-[#f1f0e9] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded bg-[#d8e2d8] hover:bg-[#edf5ed] text-[#102523] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Rating</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
