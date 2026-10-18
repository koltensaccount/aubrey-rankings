"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, Trash2, Loader2, User } from "lucide-react";

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  isAuthor: boolean;
  isCollectionOwner: boolean;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
}

interface CommentsSectionProps {
  collectionId: string;
  isOwner?: boolean;
}

export function CommentsSection({
  collectionId,
  isOwner = false,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadComments() {
      try {
        setLoading(true);
        const res = await fetch(`/api/social/comments?collectionId=${collectionId}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setComments(data.comments || []);
          }
        }
      } catch (err) {
        // Silently ignore initial fetch errors
      } finally {
        if (active) setLoading(false);
      }
    }
    loadComments();
    return () => {
      active = false;
    };
  }, [collectionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/social/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, content }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post comment");
      }

      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setNewContent("");
    } catch (err: any) {
      setError(err?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);

    try {
      const res = await fetch(`/api/social/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment", err);
    } finally {
      setDeletingId(null);
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

  return (
    <section className="mt-14 pt-10 border-t border-border space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary-text" />
          <h2 className="font-display text-2xl uppercase tracking-tight text-foreground">
            Comments
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-xs font-semibold text-primary-text">
            {comments.length}
          </span>
        </div>
      </div>

      {/* Post Comment Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative rounded-input border border-border-input bg-card focus-within:border-primary/60 transition-colors">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add a note, debate category scores, or comment on this ranking..."
            className="w-full bg-transparent p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-border/60 text-xs text-muted-foreground">
            <span>{newContent.length}/2,000 characters</span>
            <button
              type="submit"
              disabled={submitting || !newContent.trim() || newContent.length > 2000}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-button bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary text-primary-foreground font-semibold text-xs transition-colors shadow-sm shadow-primary/15"
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

            return (
              <div
                key={item.id}
                className="group relative rounded-comment border border-border-card bg-card/80 hover:bg-card p-4 transition-colors space-y-2.5"
              >
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

                    <div className="flex items-center gap-2 text-xs">
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
                    </div>
                  </div>

                  {(item.isAuthor || item.isCollectionOwner || isOwner) && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      title={item.isAuthor ? "Delete your note" : "Moderate note"}
                      aria-label="Delete comment"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-foreground leading-relaxed pl-9 whitespace-pre-line">
                  {item.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
