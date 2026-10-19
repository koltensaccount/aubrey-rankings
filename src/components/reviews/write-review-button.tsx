"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Pencil, Plus } from "lucide-react";
import { ReviewEditorDialog } from "./review-editor-dialog";

interface WriteReviewButtonProps {
  mediaItemId: string;
  mediaTitle: string;
  posterPath?: string | null;
  className?: string;
}

export function WriteReviewButton({
  mediaItemId,
  mediaTitle,
  posterPath,
  className,
}: WriteReviewButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

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
        <span>Write a Review</span>
      </button>

      <ReviewEditorDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        mediaItemId={mediaItemId}
        mediaTitle={mediaTitle}
        posterPath={posterPath}
        onSaved={(createdReview) => {
          if (createdReview?.id) {
            router.push(`/review/${createdReview.id}`);
          } else {
            router.refresh();
          }
        }}
      />
    </>
  );
}
