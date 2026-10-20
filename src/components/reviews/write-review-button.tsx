"use client";

import { useEffect, useState } from "react";
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
}: WriteReviewButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(Boolean(autoOpen));

  useEffect(() => {
    if (autoOpen || (session?.user && (searchParams?.get("journal") === "1" || searchParams?.get("journal") === "true"))) {
      setIsOpen(true);
    }
  }, [autoOpen, searchParams, session]);

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== "undefined" && window.location.search.includes("journal=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("journal");
      const nextSearch = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (nextSearch ? `?${nextSearch}` : ""));
    }
  };

  const handleClick = () => {
    setIsOpen(true);
  };

  return (
    <>
      <button
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
