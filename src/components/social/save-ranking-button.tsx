"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";

interface SaveRankingButtonProps {
  collectionId: string;
  initialIsSaved?: boolean;
  initialSavedCount?: number;
  showCount?: boolean;
  className?: string;
}

export function SaveRankingButton({
  collectionId,
  initialIsSaved = false,
  initialSavedCount = 0,
  showCount = true,
  className = "",
}: SaveRankingButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [savedCount, setSavedCount] = useState(initialSavedCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkStatus() {
      try {
        const res = await fetch(`/api/social/saved?collectionId=${collectionId}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setIsSaved(data.isSaved);
            setSavedCount(data.savedCount);
          }
        }
      } catch (err) {
        // Silently ignore network failures on initial fetch
      }
    }
    checkStatus();
    return () => {
      active = false;
    };
  }, [collectionId]);

  const handleToggleSave = async () => {
    if (loading) return;
    setLoading(true);

    const nextState = !isSaved;
    const nextCount = nextState ? savedCount + 1 : Math.max(0, savedCount - 1);

    // Optimistic update
    setIsSaved(nextState);
    setSavedCount(nextCount);

    try {
      const res = await fetch("/api/social/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          action: nextState ? "save" : "unsave",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle saved ranking");
      }

      const data = await res.json();
      setIsSaved(data.isSaved);
      setSavedCount(data.savedCount);
    } catch (err) {
      // Rollback on failure
      setIsSaved(!nextState);
      setSavedCount(savedCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleSave}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
        isSaved
          ? "bg-primary/15 text-primary border border-primary/30 shadow-xs"
          : "bg-surface hover:bg-surface-elevated text-foreground border border-border"
      } ${className}`}
      title={isSaved ? "Saved to your library (click to unsave)" : "Save ranking to library"}
      aria-label={isSaved ? "Unsave ranking" : "Save ranking"}
      aria-pressed={isSaved}
    >
      <Bookmark
        size={13}
        className={`transition-transform duration-200 ${
          isSaved ? "fill-primary text-primary scale-110" : "text-muted-foreground"
        }`}
      />
      <span>{isSaved ? "Saved" : "Save"}</span>
      {showCount && savedCount > 0 && (
        <span className="font-semibold text-[11px] opacity-80">{savedCount}</span>
      )}
    </button>
  );
}
