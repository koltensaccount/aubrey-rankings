"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { LikersDialog } from "@/components/social/likers-dialog";

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
  const [listOpen, setListOpen] = useState(false);

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

  const label = reviewId ? "review" : "ranking";
  return <>
    <span className={`inline-flex items-center rounded-full text-xs font-medium border transition-all ${isLiked ? "bg-primary/15 text-primary border-primary/30" : "bg-surface text-foreground border-border"}`}>
      <button type="button" onClick={handleToggleLike} disabled={loading} className="min-h-9 pl-3 pr-2 rounded-l-full hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" title={isLiked ? `Unlike ${label}` : `Like ${label}`} aria-label={isLiked ? `Unlike ${label}` : `Like ${label}`}>
        <Heart size={14} className={`transition-transform duration-200 ${isLiked ? "fill-current scale-110" : "text-muted-foreground"}`} />
      </button>
      <button type="button" onClick={() => setListOpen(true)} className="min-h-9 min-w-8 pl-1 pr-3 rounded-r-full hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-semibold" aria-label={`View ${likeCount} ${likeCount === 1 ? "person" : "people"} who liked this ${label}`}>
        {likeCount}
      </button>
    </span>
    <LikersDialog open={listOpen} onOpenChange={setListOpen} collectionId={collectionId} reviewId={reviewId} />
  </>;
}
