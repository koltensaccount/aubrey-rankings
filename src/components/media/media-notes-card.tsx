"use client";

import { useState } from "react";
import { Lock, Edit3, Check, X, Loader2, StickyNote } from "lucide-react";

interface MediaNotesCardProps {
  mediaItemId: string;
  initialNotes?: string | null;
  onNotesSaved?: (newNotes: string) => void;
}

export function MediaNotesCard({
  mediaItemId,
  initialNotes = "",
  onNotesSaved,
}: MediaNotesCardProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setDraftContent(notes);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftContent(notes);
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaItemId,
          content: draftContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save notes");
      }

      const data = await res.json();
      setNotes(data.notes ?? draftContent.trim());
      setIsEditing(false);
      onNotesSaved?.(data.notes ?? draftContent.trim());
    } catch (err: any) {
      setError(err.message || "Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-xl border border-border bg-card space-y-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-primary-text" />
          <h3 className="font-display text-lg font-bold tracking-tight uppercase text-foreground">
            Universal Notes
          </h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-muted-foreground border border-border">
            <Lock size={10} />
            <span>Private to you</span>
          </span>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-button text-xs font-medium text-muted-foreground hover:text-foreground bg-surface hover:bg-surface-elevated border border-border transition-colors cursor-pointer"
          >
            <Edit3 size={12} />
            <span>{notes ? "Edit" : "Add Note"}</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Your universal private notes for this title appear across your Library, your rankings, and your timeline.
      </p>

      {/* Editing State */}
      {isEditing ? (
        <div className="space-y-3 pt-1">
          <textarea
            rows={4}
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder="Add your personal notes, reminders, or private thoughts on this title..."
            className="w-full text-xs rounded-input p-3 bg-surface border border-border text-foreground leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">
              {draftContent.length} characters
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-1.5 rounded-button text-xs text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Display State */
        <div className="pt-1">
          {notes ? (
            <div className="p-3.5 rounded-lg bg-surface/70 border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
              {notes}
            </div>
          ) : (
            <div
              onClick={handleStartEdit}
              className="p-4 rounded-lg border border-dashed border-border bg-surface/30 text-center text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
            >
              No notes yet. Click here to add your private thoughts or reminders.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
