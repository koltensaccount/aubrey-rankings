"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";

interface LikeButtonProps {
  collectionId?: string;
  reviewId?: string;
  initialLikeCount?: number;
  initialIsLiked?: boolean;
}

export function LikeButton({
  collectionId,
  reviewId,
  initialLikeCount = 0,
  initialIsLiked = false,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check initial like status
    let active = true;
    async function checkStatus() {
      try {
        const query = reviewId ? `reviewId=${reviewId}` : `collectionId=${collectionId}`;
        const res = await fetch(`/api/social/like?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setIsLiked(data.isLiked);
            setLikeCount(data.likeCount);
          }
        }
      } catch (err) {
        // Silently ignore
      }
    }
    if (collectionId || reviewId) {
      checkStatus();
    }
    return () => {
      active = false;
    };
  }, [collectionId, reviewId]);

  const handleToggleLike = async () => {
    if (loading) return;
    setLoading(true);

    const nextState = !isLiked;
    const nextCount = nextState ? likeCount + 1 : Math.max(0, likeCount - 1);

    // Optimistic update
    setIsLiked(nextState);
    setLikeCount(nextCount);

    try {
      const payload: { collectionId?: string; reviewId?: string; action: string } = {
        action: nextState ? "like" : "unlike",
      };
      if (reviewId) {
        payload.reviewId = reviewId;
      } else if (collectionId) {
        payload.collectionId = collectionId;
      }

      const res = await fetch("/api/social/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await res.json();
      setIsLiked(data.isLiked);
      setLikeCount(data.likeCount);
    } catch (err) {
      // Rollback on failure
      setIsLiked(!nextState);
      setLikeCount(likeCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLike}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isLiked
          ? "bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30"
          : "bg-surface hover:bg-surface-elevated text-foreground border border-border"
      }`}
      title={isLiked ? (reviewId ? "Unlike review" : "Unlike ranking") : (reviewId ? "Like review" : "Like ranking")}
      aria-label={reviewId ? "Like review" : "Like ranking"}
    >
      <Heart
        size={14}
        className={`transition-transform duration-200 ${
          isLiked ? "fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400 scale-110" : "text-muted-foreground"
        }`}
      />
      <span className="font-semibold text-xs">{likeCount}</span>
    </button>
  );
}
