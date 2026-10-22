"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

interface MediaWatchlistButtonProps {
  mediaItemId: string;
  initialIsWatchlist: boolean;
  className?: string;
  variant?: "button" | "pill" | "icon";
}

export function MediaWatchlistButton({
  mediaItemId,
  initialIsWatchlist,
  className,
  variant = "button",
}: MediaWatchlistButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isWatchlist, setIsWatchlist] = useState(initialIsWatchlist);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (isLoading) return;

    const nextState = !isWatchlist;
    setIsWatchlist(nextState);
    setIsLoading(true);

    try {
      if (nextState) {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaItemId }),
        });
        if (!res.ok) {
          setIsWatchlist(!nextState);
        }
      } else {
        const res = await fetch(`/api/watchlist?mediaItemId=${encodeURIComponent(mediaItemId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          setIsWatchlist(!nextState);
        }
      }
      router.refresh();
    } catch {
      setIsWatchlist(!nextState);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        title={isWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
        className={`p-2 rounded-button border transition-colors flex items-center justify-center ${
          isWatchlist
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-surface"
        } ${className || ""}`}
      >
        {isLoading ? (
          <Loader2 size={15} className="animate-spin text-muted-foreground" />
        ) : isWatchlist ? (
          <BookmarkCheck size={15} className="text-primary fill-primary" />
        ) : (
          <Bookmark size={15} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button font-semibold text-xs border transition-colors cursor-pointer ${
        isWatchlist
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border bg-card hover:bg-surface text-foreground shadow-xs"
      } ${className || ""}`}
    >
      {isLoading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isWatchlist ? (
        <BookmarkCheck size={13} className="text-primary fill-primary" />
      ) : (
        <Bookmark size={13} />
      )}
      <span>{isWatchlist ? "On Watchlist" : "Add to Watchlist"}</span>
    </button>
  );
}
