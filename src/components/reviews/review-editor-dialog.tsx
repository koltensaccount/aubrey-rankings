"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Globe, Link2, Lock, EyeOff, Trash2, Bold, Italic, List, ListOrdered, Quote, Heading2, Link as LinkIcon, Eye } from "lucide-react";
import { CinematicMediaCard } from "@/components/cinematic-media-card";
import { MarkdownRenderer, ReviewContentFormat } from "@/components/reviews/markdown-renderer";

export interface ReviewEditorData {
  id?: string;
  title?: string | null;
  content: string;
  draftContent?: string | null;
  contentFormat?: ReviewContentFormat;
  draftContentFormat?: ReviewContentFormat | null;
  status: "draft" | "published" | "unpublished";
  visibility: "public" | "unlisted" | "private";
  isSpoiler: boolean;
  ratingId?: string | null;
  score?: number | null;
  tierName?: string | null;
  tierColor?: string | null;
}

interface ReviewEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItemId: string;
  mediaTitle: string;
  posterPath?: string | null;
  existingReview?: ReviewEditorData | null;
  onSaved: (savedReview: any) => void;
  onDeleted?: (deletedId: string) => void;
}

export function ReviewEditorDialog({
  isOpen,
  onClose,
  mediaItemId,
  mediaTitle,
  posterPath,
  existingReview,
  onSaved,
  onDeleted,
}: ReviewEditorDialogProps) {
  const isEditing = Boolean(existingReview?.id);
  const [title, setTitle] = useState(existingReview?.title || "");
  const [content, setContent] = useState(
    existingReview?.draftContent || existingReview?.content || ""
  );
  const [contentFormat, setContentFormat] = useState<ReviewContentFormat>(
    existingReview?.draftContent ? existingReview.draftContentFormat || existingReview.contentFormat || "plain" : existingReview?.contentFormat || "markdown"
  );
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(
    existingReview?.visibility || "public"
  );
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.isSpoiler || false);
  const [attachRating, setAttachRating] = useState(
    Boolean(existingReview?.id && existingReview?.ratingId)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(existingReview?.title || "");
      setContent(existingReview?.draftContent || existingReview?.content || "");
      setContentFormat(existingReview?.draftContent ? existingReview.draftContentFormat || existingReview.contentFormat || "plain" : existingReview?.contentFormat || "markdown");
      setMode("write");
      setVisibility(existingReview?.visibility || "public");
      setIsSpoiler(existingReview?.isSpoiler || false);
      setAttachRating(Boolean(existingReview?.id && existingReview?.ratingId));
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, existingReview]);

  const isCurrentlyPublished = existingReview?.status === "published";

  const applyFormatting = (before: string, after = before, linePrefix?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || "text";
    const formatted = linePrefix
      ? selected.split("\n").map((line, index) => `${linePrefix}${line || (index === 0 ? "text" : "")}`).join("\n")
      : `${before}${selected}${after}`;
    const next = `${content.slice(0, start)}${formatted}${content.slice(end)}`;
    setContent(next);
    setContentFormat("markdown");
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + formatted.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || document.activeElement !== textareaRef.current || !(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "b") { event.preventDefault(); applyFormatting("**"); }
      if (event.key.toLowerCase() === "i") { event.preventDefault(); applyFormatting("_"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, content]);

  const handleSave = async (targetStatus: "draft" | "published" | "unpublished") => {
    if (targetStatus === "published" && !content.trim()) {
      setError("Review content cannot be empty when publishing.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        const res = await fetch(`/api/reviews/${existingReview!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || null,
            content: targetStatus === "published" ? content.trim() : existingReview?.content || content.trim(),
            draftContent: targetStatus !== "published" ? content : null,
            contentFormat: targetStatus === "published" ? contentFormat : existingReview?.contentFormat || "plain",
            draftContentFormat: targetStatus !== "published" ? contentFormat : null,
            commitDraft: targetStatus === "published",
            status: targetStatus,
            visibility,
            isSpoiler,
            ratingId: attachRating ? (existingReview?.ratingId || null) : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update review");
        }

        const data = await res.json();
        onSaved(data.review);
        onClose();
      } else {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaItemId,
            title: title.trim() || null,
            content: content.trim(),
            draftContent: targetStatus === "draft" ? content : null,
            contentFormat,
            draftContentFormat: targetStatus === "draft" ? contentFormat : null,
            status: targetStatus,
            visibility,
            isSpoiler,
            ratingId: attachRating ? (existingReview?.ratingId || null) : null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create review");
        }

        const data = await res.json();
        onSaved(data.review);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview?.id) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reviews/${existingReview.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete review");
      }

      if (onDeleted) onDeleted(existingReview.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete review");
    } finally {
      setDeleting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-2xl flex flex-col overflow-hidden bg-card border border-border-dialog text-foreground p-4 sm:p-6 rounded-dialog shadow-dialog [&_button]:min-h-11 sm:[&_button]:min-h-0">
        <DialogHeader className="space-y-1 shrink-0 pr-10 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 flex-shrink-0">
              <CinematicMediaCard posterPath={posterPath} title={mediaTitle} aspect="poster" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl uppercase font-bold tracking-tight text-foreground">
                {isEditing ? "Edit Review" : "Write a Review"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground break-words line-clamp-2">
                {mediaTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-card bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Review Title / Headline */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Headline / Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. A bleak, razor-sharp masterpiece of technological dread"
              className="w-full px-3.5 py-2 rounded-input bg-surface border border-border-input text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              disabled={saving || deleting}
            />
          </div>

          {/* Review Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Review Content</span>
              <span className="inline-flex rounded-button border border-border bg-card p-0.5 text-[11px] font-semibold normal-case tracking-normal">
                <button type="button" onClick={() => setMode("write")} aria-pressed={mode === "write"} className={`px-2 py-1 rounded ${mode === "write" ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Write</button>
                <button type="button" onClick={() => setMode("preview")} aria-pressed={mode === "preview"} className={`px-2 py-1 rounded ${mode === "preview" ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Preview</button>
              </span>
            </label>
            {mode === "write" ? <>
              <div role="toolbar" aria-label="Markdown formatting" className="flex flex-wrap gap-1 rounded-card border border-border bg-card p-1.5">
                {([
                  { Icon: Bold, label: "Bold", action: () => applyFormatting("**") }, { Icon: Italic, label: "Italic", action: () => applyFormatting("_") }, { Icon: Heading2, label: "Heading", action: () => applyFormatting("", "", "## ") },
                  { Icon: List, label: "Bullet list", action: () => applyFormatting("", "", "- ") }, { Icon: ListOrdered, label: "Numbered list", action: () => applyFormatting("", "", "1. ") }, { Icon: Quote, label: "Quote", action: () => applyFormatting("", "", "> ") },
                  { Icon: LinkIcon, label: "Link", action: () => applyFormatting("[", "](https://)") },
                ] as const).map(({ Icon, label, action }) => <button key={label} type="button" title={label} aria-label={label} aria-keyshortcuts={label === "Bold" ? "Control+B Meta+B" : label === "Italic" ? "Control+I Meta+I" : undefined} onClick={action} disabled={saving || deleting} className="inline-flex h-8 w-8 items-center justify-center rounded-button text-muted-foreground hover:bg-surface hover:text-foreground"><Icon size={15} /></button>)}
              </div>
              <textarea ref={textareaRef} rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your thoughts, critical analysis, or reaction..." className="w-full min-h-56 px-3.5 py-2.5 rounded-input bg-surface border border-border-input text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-y leading-relaxed font-sans" disabled={saving || deleting} />
              <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer"><input type="checkbox" checked={contentFormat === "markdown"} onChange={(e) => setContentFormat(e.target.checked ? "markdown" : "plain")} className="accent-primary" disabled={saving || deleting} /> Use Markdown formatting</label>
            </> : <div className="min-h-56 rounded-card border border-border bg-surface p-4"><MarkdownRenderer content={content} format={contentFormat} className="text-sm leading-relaxed" /></div>}
          </div>

          {/* Explicit Rating Attachment Disclosure */}
          {Boolean(existingReview?.ratingId && (existingReview.score !== null || existingReview.tierName)) && (
            <div className="p-3 rounded-lg bg-surface border border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachRating}
                    onChange={(e) => setAttachRating(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    disabled={saving || deleting}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Include rating with this review
                  </span>
                </label>
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  {typeof existingReview?.score === "number" && (
                    <span>★ {existingReview.score.toFixed(1)}/10</span>
                  )}
                  {existingReview?.tierName && (
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-bold border border-border"
                      style={{
                        backgroundColor: existingReview.tierColor ? `${existingReview.tierColor}20` : "var(--surface)",
                        color: existingReview.tierColor || "var(--foreground)",
                      }}
                    >
                      Tier {existingReview.tierName}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {attachRating
                  ? "Your rating will be publicly visible alongside this review."
                  : "Your rating will remain private to your ranking and will not be disclosed on this review."}
              </p>
            </div>
          )}

          {/* Controls: Visibility & Spoiler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            {/* Visibility Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Visibility
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`px-2.5 py-1.5 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    visibility === "public"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface border-border text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={saving || deleting}
                >
                  <Globe size={13} />
                  <span>Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("unlisted")}
                  className={`px-2.5 py-1.5 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    visibility === "unlisted"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface border-border text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={saving || deleting}
                >
                  <Link2 size={13} />
                  <span>Unlisted</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("private")}
                  className={`px-2.5 py-1.5 rounded-button text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    visibility === "private"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface border-border text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={saving || deleting}
                >
                  <Lock size={13} />
                  <span>Private</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {visibility === "public"
                  ? "Visible on media page, community feeds, and your profile."
                  : visibility === "unlisted"
                    ? "Accessible only via direct link. Hidden from feeds and discovery."
                    : "Private draft visible only to you."}
              </p>
            </div>

            {/* Spoiler Toggle */}
            <div className="space-y-1.5 flex flex-col justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Content Flags
              </label>
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface border border-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(e) => setIsSpoiler(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  disabled={saving || deleting}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <EyeOff size={14} className="text-muted-foreground" />
                  <span>Contains Major Spoilers</span>
                </div>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Spoilers are concealed behind an opt-in click warning.
              </p>
            </div>
          </div>
        </div>

        {/* Delete confirmation modal view */}
        {showDeleteConfirm && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3 mt-2">
            <p className="text-xs font-semibold text-destructive">
              Are you sure you want to permanently delete this review? This action cannot be undone and will delete all associated comments and likes.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-button bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                <span>Permanently Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-button bg-surface border border-border text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        </div>

        <DialogFooter className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border mt-2">
          <div>
            {isEditing && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="inline-flex items-center gap-1.5 rounded-button px-2 text-xs font-semibold text-destructive hover:underline cursor-pointer transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete Review</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="px-3.5 py-2 rounded-button bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {/* Unpublish button if currently published */}
            {isCurrentlyPublished ? (
              <button
                type="button"
                onClick={() => handleSave("unpublished")}
                disabled={saving || deleting}
                className="px-3.5 py-2 rounded-button bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : "Unpublish"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={saving || deleting}
                className="px-3.5 py-2 rounded-button bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : "Save Draft"}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave("published")}
              disabled={saving || deleting || !content.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>{isCurrentlyPublished ? "Save & Update" : "Publish Review"}</span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
