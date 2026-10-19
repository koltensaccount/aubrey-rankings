"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface SpoilerConcealedTextProps {
  content?: string | null;
  isSpoiler?: boolean;
  className?: string;
  quoteStyle?: boolean;
}

export function SpoilerConcealedText({
  content = "",
  isSpoiler = false,
  className = "",
  quoteStyle = false,
}: SpoilerConcealedTextProps) {
  const [revealed, setRevealed] = useState(false);

  if (!content) return null;

  if (!isSpoiler) {
    return quoteStyle ? (
      <blockquote className={className}>&ldquo;{content}&rdquo;</blockquote>
    ) : (
      <p className={className}>{content}</p>
    );
  }

  if (!revealed) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border text-xs gap-3 select-none">
        <div className="flex items-center gap-2 text-muted-foreground font-medium">
          <EyeOff size={14} className="shrink-0 text-muted-foreground" />
          <span>This review contains spoilers</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed(true);
          }}
          className="px-2.5 py-1 rounded-button bg-surface-raised border border-border text-foreground hover:bg-surface text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Reveal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <span className="flex items-center gap-1 font-medium">
          <Eye size={12} />
          Spoiler revealed
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed(false);
          }}
          className="text-muted-foreground hover:text-foreground hover:underline text-[11px] cursor-pointer"
        >
          Conceal
        </button>
      </div>
      {quoteStyle ? (
        <blockquote className={className}>&ldquo;{content}&rdquo;</blockquote>
      ) : (
        <p className={className}>{content}</p>
      )}
    </div>
  );
}
