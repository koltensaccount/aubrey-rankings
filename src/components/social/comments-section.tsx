"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Reply,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldAlert,
  CornerDownRight,
  X,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export interface CommentAuthor {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string | null;
  isSpoiler?: boolean;
  isEdited?: boolean;
  isAuthor: boolean;
  isCollectionOwner: boolean;
  author: CommentAuthor;
  replies?: CommentItem[];
}

interface CommentsSectionProps {
  collectionId: string;
  isOwner?: boolean;
}

interface PendingDeleteInfo {
  id: string;
  isTopLevel: boolean;
  replyCount: number;
}

export function CommentsSection({
  collectionId,
  isOwner = false,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New top-level comment state
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newIsSpoiler, setNewIsSpoiler] = useState(false);

  // Reply state (strictly 1-level threading)
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyIsSpoiler, setReplyIsSpoiler] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Edit comment state (authors only)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Deletion confirmation state
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Revealed spoilers tracking (IDs of comments revealed by user)
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  // Active popover menu ID tracking to close on action
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/social/comments?collectionId=${collectionId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // Silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const toggleSpoilerReveal = (commentId: string) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Submit top-level comment
  const handleSubmitTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          content,
          isSpoiler: newIsSpoiler,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post note");
      }

      const data = await res.json();
      setComments((prev) => [...prev, { ...data.comment, replies: [] }]);
      setNewContent("");
      setNewIsSpoiler(false);
    } catch (err: any) {
      setError(err?.message || "Failed to post note");
    } finally {
      setSubmitting(false);
    }
  };

  // Start replying to a top-level comment
  const handleStartReply = (parentComment: CommentItem) => {
    setActiveMenuId(null);
    setReplyingToId(parentComment.id);
    setReplyContent("");
    setReplyIsSpoiler(false);
    setReplyError(null);
  };

  // Submit reply
  const handleSubmitReply = async (parentCommentId: string) => {
    const content = replyContent.trim();
    if (!content || submittingReply) return;

    setSubmittingReply(true);
    setReplyError(null);

    try {
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          content,
          parentId: parentCommentId,
          isSpoiler: replyIsSpoiler,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post reply");
      }

      const data = await res.json();
      const newReply = data.comment;

      setComments((prev) =>
        prev.map((item) => {
          if (item.id === parentCommentId) {
            return {
              ...item,
              replies: [...(item.replies || []), newReply],
            };
          }
          return item;
        })
      );

      setReplyingToId(null);
      setReplyContent("");
      setReplyIsSpoiler(false);
    } catch (err: any) {
      setReplyError(err?.message || "Failed to post reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Start editing a comment (author only)
  const handleStartEdit = (item: CommentItem) => {
    setActiveMenuId(null);
    setEditingId(item.id);
    setEditContent(item.content);
    setEditIsSpoiler(Boolean(item.isSpoiler));
    setEditError(null);
  };

  // Save edited comment
  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed || savingEdit) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/social/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          isSpoiler: editIsSpoiler,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save comment edit");
      }

      const data = await res.json();
      const updated = data.comment;

      setComments((prev) =>
        prev.map((item) => {
          if (item.id === commentId) {
            return {
              ...item,
              content: updated.content,
              isSpoiler: updated.isSpoiler,
              isEdited: true,
              updatedAt: updated.updatedAt,
            };
          }
          if (item.replies) {
            return {
              ...item,
              replies: item.replies.map((reply) => {
                if (reply.id === commentId) {
                  return {
                    ...reply,
                    content: updated.content,
                    isSpoiler: updated.isSpoiler,
                    isEdited: true,
                    updatedAt: updated.updatedAt,
                  };
                }
                return reply;
              }),
            };
          }
          return item;
        })
      );

      setEditingId(null);
      setEditContent("");
    } catch (err: any) {
      setEditError(err?.message || "Failed to save edit");
    } finally {
      setSavingEdit(false);
    }
  };

  // Prompt delete confirmation
  const handlePromptDelete = (item: CommentItem, isTopLevel: boolean) => {
    setActiveMenuId(null);
    setPendingDelete({
      id: item.id,
      isTopLevel,
      replyCount: isTopLevel && item.replies ? item.replies.length : 0,
    });
  };

  // Confirm and execute deletion
  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleting) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/social/comments/${pendingDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete note");
      }

      if (pendingDelete.isTopLevel) {
        setComments((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      } else {
        setComments((prev) =>
          prev.map((parent) => ({
            ...parent,
            replies: (parent.replies || []).filter((r) => r.id !== pendingDelete.id),
          }))
        );
      }

      setPendingDelete(null);
    } catch (err) {
      console.error("Failed to delete comment:", err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCommentDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  };

  const totalCommentCount = comments.reduce(
    (acc, curr) => acc + 1 + (curr.replies ? curr.replies.length : 0),
    0
  );

  return (
    <section className="mt-14 pt-10 border-t border-border space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary-text" />
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Comments & Discussion
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-xs font-semibold text-primary-text">
            {totalCommentCount}
          </span>
        </div>
      </div>

      {/* Top-Level Post Note Composer */}
      <form onSubmit={handleSubmitTopLevel} className="space-y-3">
        <div className="relative rounded-input border border-border-input bg-card focus-within:border-primary/60 transition-colors">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add a note, debate category scores, or comment on this ranking..."
            className="w-full bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{newContent.length}/2,000 characters</span>

              {/* Spoiler Toggle */}
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={newIsSpoiler}
                  onChange={(e) => setNewIsSpoiler(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle size={12} className={newIsSpoiler ? "text-amber-500" : ""} />
                  Mark as spoiler
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !newContent.trim() || newContent.length > 2000}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-button bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary text-primary-foreground font-semibold text-xs transition-colors shadow-sm shadow-primary/15 cursor-pointer"
            >
              {submitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              <span>Post Note</span>
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-comment">
          No critical notes yet. Be the first to comment on this canon.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((item) => {
            const authorInitial = (
              item.author.name ||
              item.author.username ||
              "U"
            )
              .charAt(0)
              .toUpperCase();

            const profileHref = item.author.username
              ? `/u/${item.author.username}`
              : null;

            const isRevealed = revealedSpoilers.has(item.id);
            const isEditingThis = editingId === item.id;
            const isReplyingThis = replyingToId === item.id;

            const canModerate = item.isCollectionOwner || isOwner;
            const canManage = item.isAuthor || canModerate;

            return (
              <div
                key={item.id}
                className="group relative rounded-comment border border-border-card bg-card/80 hover:bg-card p-4 transition-colors space-y-3"
              >
                {/* Header: Author + Timestamp + Three-dot Menu */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="h-7 w-7 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                      >
                        {item.author.image ? (
                          <img
                            src={item.author.image}
                            alt={item.author.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          authorInitial
                        )}
                      </Link>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-semibold text-primary-text shrink-0">
                        {authorInitial}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="font-medium text-foreground hover:text-primary-text transition-colors"
                        >
                          {item.author.name || `@${item.author.username}`}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">
                          {item.author.name || "Anonymous Critic"}
                        </span>
                      )}

                      {item.author.username && (
                        <span className="text-muted-foreground">@{item.author.username}</span>
                      )}

                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatCommentDate(item.createdAt)}
                      </span>

                      {/* Edited Flag */}
                      {item.isEdited && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground/80 italic">
                            Edited
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions: Three-dot Menu */}
                  <div className="flex items-center gap-1">
                    <Popover
                      open={activeMenuId === item.id}
                      onOpenChange={(open) => setActiveMenuId(open ? item.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                          aria-label="Comment actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        sideOffset={4}
                        className="w-44 p-1 rounded-card border border-border bg-card shadow-dialog"
                      >
                        <div className="space-y-0.5 text-xs">
                          {/* Reply Action */}
                          <button
                            type="button"
                            onClick={() => handleStartReply(item)}
                            className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-surface flex items-center gap-2 text-foreground transition-colors cursor-pointer"
                          >
                            <Reply size={13} className="text-primary-text" />
                            <span>Reply</span>
                          </button>

                          {/* Edit Action (Author only) */}
                          {item.isAuthor && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-surface flex items-center gap-2 text-foreground transition-colors cursor-pointer"
                            >
                              <Pencil size={13} className="text-muted-foreground" />
                              <span>Edit note</span>
                            </button>
                          )}

                          {/* Delete Action (Author OR Moderation) */}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handlePromptDelete(item, true)}
                              className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors cursor-pointer"
                            >
                              {item.isAuthor ? (
                                <Trash2 size={13} />
                              ) : (
                                <ShieldAlert size={13} />
                              )}
                              <span>
                                {item.isAuthor ? "Delete note" : "Moderate note"}
                              </span>
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Comment Body / Edit View */}
                {isEditingThis ? (
                  <div className="pl-9 space-y-2">
                    <div className="rounded-input border border-border-input bg-surface p-2.5 focus-within:border-primary/60 transition-colors">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>{editContent.length}/2,000</span>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                            <input
                              type="checkbox"
                              checked={editIsSpoiler}
                              onChange={(e) => setEditIsSpoiler(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            <span>Spoiler</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={savingEdit}
                            className="px-2.5 py-1 rounded-button border border-border hover:bg-surface-raised text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={savingEdit || !editContent.trim()}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
                          >
                            {savingEdit ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} />
                            )}
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {editError && <p className="text-xs text-destructive">{editError}</p>}
                  </div>
                ) : item.isSpoiler && !isRevealed ? (
                  /* Spoiler Protected Mask */
                  <div className="pl-9">
                    <div className="rounded-card bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-amber-500 font-medium">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>This note contains spoilers</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSpoilerReveal(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-button bg-surface hover:bg-surface-raised border border-border text-foreground font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Reveal note</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal Comment Text (or revealed spoiler) */
                  <div className="pl-9 space-y-1.5">
                    {item.isSpoiler && isRevealed && (
                      <div className="flex items-center gap-2 text-[11px] text-amber-500 font-medium">
                        <span>[Spoiler revealed]</span>
                        <button
                          type="button"
                          onClick={() => toggleSpoilerReveal(item.id)}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <EyeOff size={11} />
                          <span>Hide</span>
                        </button>
                      </div>
                    )}
                    <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>
                  </div>
                )}

                {/* Inline Quick Action: Reply button */}
                <div className="pl-9 flex items-center gap-4 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => handleStartReply(item)}
                    className="inline-flex items-center gap-1 hover:text-primary-text transition-colors cursor-pointer font-medium"
                  >
                    <Reply size={12} />
                    <span>Reply</span>
                  </button>
                </div>

                {/* Inline Reply Composer (when replying to this top-level comment) */}
                {isReplyingThis && (
                  <div className="pl-6 sm:pl-9 mt-2 pt-2 border-t border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CornerDownRight size={13} className="text-primary-text" />
                        <span>
                          Replying to{" "}
                          <strong className="text-foreground font-semibold">
                            @{item.author.username || item.author.name}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingToId(null)}
                        className="p-0.5 hover:text-foreground text-muted-foreground cursor-pointer"
                        aria-label="Cancel reply"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="rounded-input border border-border-input bg-surface p-2.5 focus-within:border-primary/60 transition-colors">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        placeholder={`Write a reply to ${item.author.name || "author"}...`}
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>{replyContent.length}/2,000</span>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                            <input
                              type="checkbox"
                              checked={replyIsSpoiler}
                              onChange={(e) => setReplyIsSpoiler(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            <span>Spoiler</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReplyingToId(null)}
                            disabled={submittingReply}
                            className="px-2.5 py-1 rounded-button border border-border hover:bg-surface-raised text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitReply(item.id)}
                            disabled={submittingReply || !replyContent.trim()}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
                          >
                            {submittingReply ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Send size={11} />
                            )}
                            <span>Post Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {replyError && <p className="text-xs text-destructive">{replyError}</p>}
                  </div>
                )}

                {/* 1-Level Threaded Replies Display */}
                {item.replies && item.replies.length > 0 && (
                  <div className="pl-4 sm:pl-6 border-l-2 border-border/60 ml-3 sm:ml-5 mt-3 space-y-3">
                    {item.replies.map((reply) => {
                      const replyAuthorInitial = (
                        reply.author.name ||
                        reply.author.username ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase();

                      const replyProfileHref = reply.author.username
                        ? `/u/${reply.author.username}`
                        : null;

                      const replyIsRevealed = revealedSpoilers.has(reply.id);
                      const isEditingReply = editingId === reply.id;
                      const canModerateReply = reply.isCollectionOwner || isOwner;
                      const canManageReply = reply.isAuthor || canModerateReply;

                      return (
                        <div
                          key={reply.id}
                          className="rounded-comment border border-border/80 bg-surface/60 p-3 space-y-2 transition-colors"
                        >
                          {/* Reply Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {replyProfileHref ? (
                                <Link
                                  href={replyProfileHref}
                                  className="h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center text-[11px] font-semibold text-primary-text hover:border-primary transition-colors shrink-0 overflow-hidden"
                                >
                                  {reply.author.image ? (
                                    <img
                                      src={reply.author.image}
                                      alt={reply.author.name || "User"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    replyAuthorInitial
                                  )}
                                </Link>
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center text-[11px] font-semibold text-primary-text shrink-0">
                                  {replyAuthorInitial}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                {replyProfileHref ? (
                                  <Link
                                    href={replyProfileHref}
                                    className="font-medium text-foreground hover:text-primary-text transition-colors"
                                  >
                                    {reply.author.name || `@${reply.author.username}`}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-foreground">
                                    {reply.author.name || "Critic"}
                                  </span>
                                )}

                                {reply.author.username && (
                                  <span className="text-muted-foreground">@{reply.author.username}</span>
                                )}

                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">
                                  {formatCommentDate(reply.createdAt)}
                                </span>

                                {reply.isEdited && (
                                  <>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-[11px] text-muted-foreground/80 italic">
                                      Edited
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Reply Action: Three-dot Menu (Edit if author, Delete if author or collection owner) */}
                            {canManageReply && (
                              <Popover
                                open={activeMenuId === reply.id}
                                onOpenChange={(open) => setActiveMenuId(open ? reply.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                                    aria-label="Reply actions"
                                  >
                                    <MoreHorizontal size={13} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  sideOffset={4}
                                  className="w-40 p-1 rounded-card border border-border bg-card shadow-dialog"
                                >
                                  <div className="space-y-0.5 text-xs">
                                    {reply.isAuthor && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(reply)}
                                        className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-surface flex items-center gap-2 text-foreground transition-colors cursor-pointer"
                                      >
                                        <Pencil size={13} className="text-muted-foreground" />
                                        <span>Edit reply</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handlePromptDelete(reply, false)}
                                      className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-destructive/10 flex items-center gap-2 text-destructive transition-colors cursor-pointer"
                                    >
                                      {reply.isAuthor ? (
                                        <Trash2 size={13} />
                                      ) : (
                                        <ShieldAlert size={13} />
                                      )}
                                      <span>
                                        {reply.isAuthor ? "Delete reply" : "Moderate reply"}
                                      </span>
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>

                          {/* Reply Body / Edit Mode */}
                          {isEditingReply ? (
                            <div className="pl-8 space-y-2">
                              <div className="rounded-input border border-border-input bg-card p-2.5 focus-within:border-primary/60 transition-colors">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  maxLength={2000}
                                  rows={2}
                                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
                                />
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-3">
                                    <span>{editContent.length}/2,000</span>
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                                      <input
                                        type="checkbox"
                                        checked={editIsSpoiler}
                                        onChange={(e) => setEditIsSpoiler(e.target.checked)}
                                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                                      />
                                      <span>Spoiler</span>
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingId(null)}
                                      disabled={savingEdit}
                                      className="px-2.5 py-1 rounded-button border border-border hover:bg-surface-raised text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(reply.id)}
                                      disabled={savingEdit || !editContent.trim()}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-button bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
                                    >
                                      {savingEdit ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : (
                                        <Check size={11} />
                                      )}
                                      <span>Save</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {editError && <p className="text-xs text-destructive">{editError}</p>}
                            </div>
                          ) : reply.isSpoiler && !replyIsRevealed ? (
                            /* Reply Spoiler Protected Mask */
                            <div className="pl-8">
                              <div className="rounded-card bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                                  <AlertTriangle size={13} className="shrink-0" />
                                  <span>Contains spoilers</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleSpoilerReveal(reply.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-button bg-surface hover:bg-surface-raised border border-border text-foreground font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  <Eye size={11} />
                                  <span>Reveal</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Normal Reply Text */
                            <div className="pl-8 space-y-1">
                              {reply.isSpoiler && replyIsRevealed && (
                                <div className="flex items-center gap-2 text-[10px] text-amber-500 font-medium">
                                  <span>[Spoiler revealed]</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleSpoilerReveal(reply.id)}
                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    <EyeOff size={10} />
                                    <span>Hide</span>
                                  </button>
                                </div>
                              )}
                              <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
                                {reply.content}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Deletions */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this note? This action cannot be undone.
              {pendingDelete?.isTopLevel && pendingDelete.replyCount > 0 && (
                <span className="block mt-2 text-amber-500 font-medium">
                  Warning: This note has {pendingDelete.replyCount}{" "}
                  {pendingDelete.replyCount === 1 ? "reply" : "replies"} that will also be permanently deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-button border border-border bg-surface hover:bg-surface-raised text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-button bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              {deleting && <Loader2 size={13} className="animate-spin" />}
              <span>Delete Note</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
