"use client";

import React from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface DeleteCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  collectionTitle: string;
  isDeleting: boolean;
}

export function DeleteCollectionDialog({
  isOpen,
  onClose,
  onConfirm,
  collectionTitle,
  isDeleting,
}: DeleteCollectionDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-dialog bg-card border border-destructive/30 p-6 shadow-dialog space-y-4">
        <div className="flex items-center gap-3 text-destructive">
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
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-button bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
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
  );
}

interface RemoveEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entry: any;
  isDeleting: boolean;
}

export function RemoveEntryDialog({
  isOpen,
  onClose,
  onConfirm,
  entry,
  isDeleting,
}: RemoveEntryDialogProps) {
  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-dialog bg-card border border-border-dialog p-6 shadow-dialog space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <Trash2 className="h-5 w-5 shrink-0" />
          <h3 className="font-display text-xl uppercase font-bold text-foreground">
            Remove Entry
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Remove <strong className="text-foreground">{entry.mediaItem?.title}</strong> from this ranking?
          The item will be removed from this list, but your rating and TMDB metadata are preserved.
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-button bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
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
  );
}
