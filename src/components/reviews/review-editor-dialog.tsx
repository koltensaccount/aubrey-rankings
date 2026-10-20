"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { prefixMarkdownLines } from "@/components/reviews/markdown-formatting";
import { CinematicSlider } from "@/components/cinematic-slider";

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
  shareRating?: boolean;
  isJournal?: boolean;
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
  journalMode?: boolean;
  initialQuickScore?: number | null;
  initialDetailedRating?: { ratingSystemId: string; categoryScores: Array<{ categoryId: string; score: number }> } | null;
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
  journalMode = false,
  initialQuickScore = null,
  initialDetailedRating = null,
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
    existingReview?.visibility || "private"
  );
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.isSpoiler || false);
  const privacyEdited = useRef(false);
  const spoilerEdited = useRef(false);
  const [attachRating, setAttachRating] = useState(
    Boolean(existingReview?.id && existingReview?.ratingId)
  );
  const [shareRating, setShareRating] = useState(Boolean(existingReview?.shareRating));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quickScore, setQuickScore] = useState<number | null>(initialQuickScore);
  const [quickScoreTouched, setQuickScoreTouched] = useState(false);
  const [scoringMethod, setScoringMethod] = useState<"quick" | "detailed">("quick");
  const [ratingSystems, setRatingSystems] = useState<any[]>([]);
  const [ratingSystemId, setRatingSystemId] = useState("");
  const [categoryValues, setCategoryValues] = useState<Record<string, number | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(existingReview?.title || "");
      setContent(existingReview?.draftContent || existingReview?.content || "");
      setContentFormat(existingReview?.draftContent ? existingReview.draftContentFormat || existingReview.contentFormat || "plain" : existingReview?.contentFormat || "markdown");
      setMode("write");
      setVisibility(existingReview?.visibility || "private");
      setIsSpoiler(existingReview?.isSpoiler || false);
      privacyEdited.current = false;
      spoilerEdited.current = false;
      setAttachRating(Boolean(existingReview?.id && existingReview?.ratingId));
      setShareRating(Boolean(existingReview?.shareRating));
      setError(null);
      setShowDeleteConfirm(false);
      setQuickScore(initialQuickScore);
      setQuickScoreTouched(false);
      setScoringMethod(initialDetailedRating ? "detailed" : "quick");
      setRatingSystemId(initialDetailedRating?.ratingSystemId || "");
      setCategoryValues(Object.fromEntries(initialDetailedRating?.categoryScores.map((score) => [score.categoryId, score.score]) || []));
    }
  }, [isOpen, existingReview, initialQuickScore, initialDetailedRating, journalMode]);

  useEffect(() => {
    if (!isOpen || !journalMode) return;
    fetch("/api/rating-systems").then((response) => response.ok ? response.json() : []).then((systems) => setRatingSystems(Array.isArray(systems) ? systems.filter((system) => system.type === "numerical") : [])).catch(() => setRatingSystems([]));
  }, [isOpen, journalMode]);
  useEffect(() => {
    if (!isOpen || existingReview?.id) return;
    let active = true;
    fetch("/api/user/privacy").then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active || !data?.privacy) return;
      if (!privacyEdited.current && !journalMode && ["private", "unlisted", "public"].includes(data.privacy.defaultReviewVisibility)) setVisibility(data.privacy.defaultReviewVisibility);
      if (!spoilerEdited.current) setIsSpoiler(Boolean(data.privacy.defaultReviewSpoiler));
    }).catch(() => {});
    return () => { active = false; };
  }, [isOpen, existingReview?.id, journalMode]);
  const selectedSystem = useMemo(() => ratingSystems.find((system) => system.id === ratingSystemId), [ratingSystems, ratingSystemId]);

  const isCurrentlyPublished = existingReview?.status === "published";

  const applyFormatting = (before: string, after = before, linePrefix?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || "text";
    const lineFormat = linePrefix ? prefixMarkdownLines(content, start, end, linePrefix) : null;
    const formatted = lineFormat ? "" : `${before}${selected}${after}`;
    const next = lineFormat?.content || `${content.slice(0, start)}${formatted}${content.slice(end)}`;
    setContent(next);
    setContentFormat("markdown");
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = lineFormat?.selectionStart ?? start + formatted.length;
      const selectionEnd = lineFormat?.selectionEnd ?? selectionStart;
      textarea.setSelectionRange(selectionStart, selectionEnd);
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
    if (targetStatus === "published" && !content.trim() && (!journalMode || (scoringMethod === "quick" ? quickScore === null : !selectedSystem))) {
      setError("Review content cannot be empty when publishing.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (journalMode) {
        const shouldSaveWriting = Boolean(existingReview?.id || title.trim() || content.trim());
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaItemId,
            quickScore: scoringMethod === "quick" && quickScoreTouched ? quickScore : undefined,
            detailedRating: scoringMethod === "detailed" && selectedSystem ? { ratingSystemId, scores: categoryValues } : undefined,
            clearRating: scoringMethod === "quick" && quickScoreTouched && quickScore === null,
            review: shouldSaveWriting ? {
              id: existingReview?.id,
              title: title.trim() || null,
              content,
              status: targetStatus,
              visibility,
              isSpoiler,
              shareRating,
            } : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save journal entry");
        }
        const data = await res.json();
        onSaved(data.review || data.rating);
        onClose();
        return;
      }
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
            shareRating: existingReview?.isJournal ? shareRating : undefined,
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
                {journalMode ? (isEditing ? "Edit Journal Entry" : "Add to Journal") : isEditing ? "Edit Review" : "Write a Review"}
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
          {journalMode && (
            <div className="space-y-2 rounded-card border border-border bg-surface/50 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Rating <span className="text-muted-foreground normal-case font-normal">(optional)</span></h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Leave unset for writing only.</p>
                </div>
                {scoringMethod === "quick" && quickScore !== null && <button type="button" onClick={() => { setQuickScore(null); setQuickScoreTouched(true); }} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
              </div>
              <div className="flex gap-2 text-xs font-semibold"><button type="button" onClick={() => setScoringMethod("quick")} className={scoringMethod === "quick" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>Quick score</button><button type="button" onClick={() => setScoringMethod("detailed")} className={scoringMethod === "detailed" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>Detailed rubric</button></div>
              {scoringMethod === "quick" ? <CinematicSlider value={quickScore} min={0} max={10} step={0.1} valuePrecision={1} valueSuffix="/10" showValue ariaLabel="Quick rating out of 10" onChange={(value) => { setQuickScore(value); setQuickScoreTouched(true); }} /> : <div className="space-y-2"><select value={ratingSystemId} onChange={(event) => { setRatingSystemId(event.target.value); setCategoryValues({}); }} className="w-full rounded-input border border-border-input bg-surface px-3 py-2 text-sm text-foreground"><option value="">Choose a numerical rubric</option>{ratingSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select>{selectedSystem?.categories?.map((category: any) => <div key={category.id} className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>{category.name}</span><span>{category.weight.toFixed(1)}×</span></div><CinematicSlider value={categoryValues[category.id] ?? null} min={0} max={selectedSystem.scale || 10} step={0.5} valuePrecision={1} ariaLabel={`${category.name} score`} onChange={(value) => setCategoryValues((previous) => ({ ...previous, [category.id]: value }))} /></div>)}</div>}
            </div>
          )}
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

          {(journalMode || existingReview?.isJournal) && <label className="flex items-start gap-2 text-xs text-foreground"><input type="checkbox" checked={shareRating} onChange={(event) => setShareRating(event.target.checked)} className="accent-primary mt-0.5" disabled={saving || deleting} /><span>Include my rating with this review <span className="text-muted-foreground">(visible wherever the review is shared)</span></span></label>}
          {/* Explicit Rating Attachment Disclosure */}
          {!journalMode && !existingReview?.isJournal && Boolean(existingReview?.ratingId && (existingReview.score !== null || existingReview.tierName)) && (
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
                  ? visibility === "unlisted"
                    ? "Your rating will be visible alongside this review to anyone with the direct link."
                    : visibility === "private"
                      ? "Your rating is attached to this review, but the review is private."
                      : isCurrentlyPublished
                        ? "Your rating will be publicly visible alongside this review."
                        : "Your rating will be publicly visible alongside this review when published (saving as a draft keeps it private)."
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
                  onClick={() => { privacyEdited.current = true; setVisibility("public"); }}
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
                  onClick={() => { privacyEdited.current = true; setVisibility("unlisted"); }}
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
                  onClick={() => { privacyEdited.current = true; setVisibility("private"); }}
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
                  onChange={(e) => { spoilerEdited.current = true; setIsSpoiler(e.target.checked); }}
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

        {/* Deliberate Sharing Clarity Banner */}
        {(() => {
          const persistedVisibility = existingReview?.visibility ?? "private";
          const hasUnsavedVisibilityChange = Boolean(existingReview && existingReview.visibility !== visibility);

          let bannerTitle = "";
          let bannerDescription = "";
          let Icon = Lock;
          let isPublicThemed = false;

          if (isCurrentlyPublished && !hasUnsavedVisibilityChange) {
            if (visibility === "public") {
              Icon = Globe;
              isPublicThemed = true;
              bannerTitle = "Published Public Review";
              bannerDescription = "This published review is visible in the Community Feed, on this title's public page, and on your profile.";
            } else if (visibility === "unlisted") {
              Icon = Link2;
              isPublicThemed = false;
              bannerTitle = "Unlisted Review (Live by Direct Link)";
              bannerDescription = "Accessible to anyone with the direct link. Hidden from the Community Feed and search discovery.";
            } else {
              Icon = Lock;
              isPublicThemed = false;
              bannerTitle = "Private Journal Entry (Never Shared)";
              bannerDescription = "Visible exclusively to you in your personal Journal. Never published to the Community Feed or visible to other members.";
            }
          } else if (hasUnsavedVisibilityChange) {
            if (visibility === "public") {
              Icon = Globe;
              isPublicThemed = true;
              bannerTitle = "Unsaved Change: Publish to Community";
              bannerDescription = `This entry is currently ${persistedVisibility === "private" ? "private" : "unlisted"}. Once saved, it will become publicly visible in the Community Feed, on your profile, and on this title's page.`;
            } else if (visibility === "unlisted") {
              Icon = Link2;
              isPublicThemed = false;
              bannerTitle = "Unsaved Change: Make Unlisted";
              bannerDescription = `This entry is currently ${persistedVisibility === "public" ? "public" : "private"}. Once saved, it will be accessible only via direct link and hidden from feeds.`;
            } else {
              Icon = Lock;
              isPublicThemed = false;
              bannerTitle = "Unsaved Change: Set to Private";
              bannerDescription = `This entry is currently ${persistedVisibility === "public" ? "publicly visible" : "accessible via direct link"}. Saving your changes will make it private and remove it from public view.`;
            }
          } else {
            // New entry or currently unpublished/draft
            if (visibility === "public") {
              Icon = Globe;
              isPublicThemed = true;
              bannerTitle = "Public Review (When Published)";
              bannerDescription = "When published, this review will appear in the Community Feed, on this title's public page, and on your profile. Saving as a draft will keep it private and unpublished.";
            } else if (visibility === "unlisted") {
              Icon = Link2;
              isPublicThemed = false;
              bannerTitle = "Unlisted Entry (When Published)";
              bannerDescription = "When published, this review is accessible only via direct link and hidden from the Community Feed. Saving as a draft keeps it private.";
            } else {
              Icon = Lock;
              isPublicThemed = false;
              bannerTitle = "Private Journal Entry (Never Shared)";
              bannerDescription = "Visible exclusively to you in your personal Journal. Never published to the Community Feed or visible to other members.";
            }
          }

          const hasScore = scoringMethod === "quick" ? quickScore !== null : Boolean(selectedSystem);

          let ratingDisclosureText = "";
          if (hasScore) {
            if (!shareRating) {
              ratingDisclosureText = "🔒 Your numerical rating remains private and will NOT be shown.";
            } else if (isCurrentlyPublished && !hasUnsavedVisibilityChange) {
              if (visibility === "public") {
                ratingDisclosureText = "✓ Your numerical rating is shared publicly.";
              } else if (visibility === "unlisted") {
                ratingDisclosureText = "✓ Your numerical rating is visible to anyone with the direct link.";
              } else {
                ratingDisclosureText = "🔒 Private entries are only visible to you; your rating is not shared with others.";
              }
            } else if (hasUnsavedVisibilityChange) {
              if (visibility === "public") {
                ratingDisclosureText = "✓ Your numerical rating will be shared publicly once saved.";
              } else if (visibility === "unlisted") {
                ratingDisclosureText = "✓ Your numerical rating will be visible via direct link once saved.";
              } else {
                ratingDisclosureText = "🔒 Once saved as private, your rating will no longer be shared with others.";
              }
            } else {
              // Draft or new entry
              if (visibility === "public") {
                ratingDisclosureText = "✓ Your numerical rating will be shared publicly when published (saving as a draft keeps it private).";
              } else if (visibility === "unlisted") {
                ratingDisclosureText = "✓ Your numerical rating will be visible via direct link when published (saving as a draft keeps it private).";
              } else {
                ratingDisclosureText = "🔒 Private entries are only visible to you; your rating is not shared with others.";
              }
            }
          }

          return (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 transition-colors ${
                isPublicThemed
                  ? "bg-primary/10 border-primary/20 text-foreground"
                  : "bg-surface border-border text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Icon size={14} className={isPublicThemed ? "text-primary" : "text-foreground"} />
                <span>{bannerTitle}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {bannerDescription}
                {hasScore && ratingDisclosureText && (
                  <span className="block mt-0.5 font-medium text-foreground">
                    {ratingDisclosureText}
                  </span>
                )}
              </p>
            </div>
          );
        })()}

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
              disabled={saving || deleting || (!journalMode && !content.trim()) || (journalMode && !content.trim() && (scoringMethod === "quick" ? quickScore === null : !selectedSystem))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-button bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>
                {journalMode
                  ? visibility === "public"
                    ? isCurrentlyPublished
                      ? "Update Public Review"
                      : "Publish to Community"
                    : visibility === "unlisted"
                      ? "Save as Unlisted"
                      : "Save Private Entry"
                  : isCurrentlyPublished
                    ? "Save & Update"
                    : visibility === "public"
                      ? "Publish Review"
                      : "Save Review"}
              </span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
