"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Pencil } from "lucide-react";
import { ReviewEditorDialog } from "./review-editor-dialog";
import type { ReviewEditorData } from "./review-editor-dialog";

interface WriteReviewButtonProps {
  mediaItemId: string;
  mediaTitle: string;
  posterPath?: string | null;
  className?: string;
  existingReview?: ReviewEditorData | null;
  initialQuickScore?: number | null;
  initialDetailedRating?: { ratingSystemId: string; categoryScores: Array<{ categoryId: string; score: number }> } | null;
  autoOpen?: boolean;
  buttonId?: string;
  isCanonical?: boolean;
}

export function WriteReviewButton({
  mediaItemId,
  mediaTitle,
  posterPath,
  className,
  existingReview,
  initialQuickScore,
  initialDetailedRating,
  autoOpen = false,
  buttonId,
  isCanonical = false,
}: WriteReviewButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const isCanonicalButton = isCanonical || buttonId === "canonical-journal-button";

  // Track which mediaItemId has already been auto-opened to ensure auto-open runs only ONCE per media item
  const autoOpenedMediaIdRef = useRef<string | null>(null);

  // Cleanly remove journal query parameter while strictly preserving all other parameters
  const removeJournalParam = () => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("journal")) {
        url.searchParams.delete("journal");
        const nextQuery = url.searchParams.toString();
        const nextUrl = url.pathname + (nextQuery ? `?${nextQuery}` : "") + url.hash;
        window.history.replaceState({}, "", nextUrl);
      }
    } catch {}
  };

  useEffect(() => {
    // Only auto-open if session is present (never open for unauthenticated users)
    // Only the explicit autoOpen prop or canonical button matching ?journal=1 should trigger auto-open
    const isJournalRequested = autoOpen || (isCanonicalButton && (searchParams?.get("journal") === "1" || searchParams?.get("journal") === "true"));
    if (session?.user && isJournalRequested) {
      if (autoOpenedMediaIdRef.current !== mediaItemId) {
        autoOpenedMediaIdRef.current = mediaItemId;
        setIsOpen(true);
        removeJournalParam();
      }
    }
  }, [autoOpen, isCanonicalButton, searchParams, session, mediaItemId]);

  // Listen for custom trigger only on the canonical button to avoid multiple dialogs
  useEffect(() => {
    if (!isCanonicalButton) return;
    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener("aubrey:open-journal", handleCustomOpen);
    return () => window.removeEventListener("aubrey:open-journal", handleCustomOpen);
  }, [isCanonicalButton]);

  const handleClose = () => {
    setIsOpen(false);
    removeJournalParam();
  };

  const handleClick = () => {
    if (!session?.user) {
      const currentUrl = typeof window !== "undefined"
        ? window.location.pathname + (window.location.search ? (window.location.search.includes("journal=1") ? window.location.search : `${window.location.search}&journal=1`) : "?journal=1")
        : `/media/${mediaItemId}?journal=1`;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      <button
        id={buttonId || (isCanonicalButton ? "canonical-journal-button" : undefined)}
        type="button"
        onClick={handleClick}
        className={
          className ||
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
        }
      >
        <Pencil size={13} />
        <span>{existingReview || initialQuickScore !== null || initialDetailedRating ? "Edit Journal Entry" : "Add to Journal"}</span>
      </button>

      <ReviewEditorDialog
        isOpen={isOpen}
        onClose={handleClose}
        mediaItemId={mediaItemId}
        mediaTitle={mediaTitle}
        posterPath={posterPath}
        existingReview={existingReview}
        initialQuickScore={initialQuickScore}
        initialDetailedRating={initialDetailedRating}
        journalMode
        onSaved={(createdReview) => {
          handleClose();
          if (createdReview?.id && createdReview?.status === "published" && createdReview?.visibility !== "private") {
            router.push(`/review/${createdReview.id}`);
          } else {
            router.refresh();
          }
        }}
      />
    </>
  );
}

export function JournalTriggerButton({
  className,
  label,
  hasEntry = false,
}: {
  className?: string;
  label?: string;
  hasEntry?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("aubrey:open-journal"))}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs transition-colors cursor-pointer"
      }
    >
      <Pencil size={13} />
      <span>{label || (hasEntry ? "Edit Journal Entry" : "Add to Journal")}</span>
    </button>
  );
}
