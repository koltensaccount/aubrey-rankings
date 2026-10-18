"use client";

import { Trash2 } from "lucide-react";

interface RatingClearDialogProps {
  mediaTitle: string;
  deleting: boolean;
  onCancel: () => void;
  onClearScoresOnly: () => void;
  onDeleteEntireRating: () => void;
}

export function RatingClearDialog({
  mediaTitle,
  deleting,
  onCancel,
  onClearScoresOnly,
  onDeleteEntireRating,
}: RatingClearDialogProps) {
  return (
    <div className="p-4 bg-red-950/20 border-t border-red-500/30 space-y-3 shrink-0">
      <div className="flex items-center gap-2 text-red-400 text-xs font-semibold uppercase tracking-wider">
        <Trash2 size={14} />
        <span>Confirm Rating Removal</span>
      </div>
      <p className="text-xs text-foreground/85 leading-relaxed">
        Choose how you want to clear your rating for &ldquo;{mediaTitle}&rdquo;:
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearScoresOnly}
            disabled={deleting}
            className="px-3 py-1.5 rounded-button text-xs font-semibold bg-surface-elevated hover:bg-muted text-foreground border border-border cursor-pointer transition-colors"
          >
            Clear Scores Only (Keep Review & Notes)
          </button>
          <button
            type="button"
            onClick={onDeleteEntireRating}
            disabled={deleting}
            className="px-3 py-1.5 rounded-button text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 cursor-pointer transition-colors"
          >
            Delete Entire Rating
          </button>
        </div>
      </div>
    </div>
  );
}
