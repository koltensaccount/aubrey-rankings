"use client";

import { personalReviewScore } from "@/lib/review-rating";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  Pencil,
  EyeOff,
  Eye,
  Globe,
  Link2,
  Lock,
  Flag,
  Check,
  Calendar,
  Star,
  Film,
  Tv,
} from "lucide-react";
import { LikeButton } from "@/components/social/like-button";
import { ReportDialog } from "@/components/social/report-dialog";
import { CommentsSection } from "@/components/social/comments-section";
import { ReviewEditorDialog } from "@/components/reviews/review-editor-dialog";
import { MarkdownRenderer, ReviewContentFormat } from "@/components/reviews/markdown-renderer";
import { resolvePosterUrl } from "@/lib/artwork";
import { getTmdbImageUrl } from "@/lib/tmdb";
import { getPublicMediaUrl } from "@/lib/media-url";

interface ReviewDetailClientProps {
  initialReview: {
    id: string;
    userId: string;
    title: string | null;
    content: string;
    draftContent?: string | null;
    contentFormat: ReviewContentFormat;
    draftContentFormat?: ReviewContentFormat | null;
    status: "draft" | "published" | "unpublished";
    visibility: "public" | "unlisted" | "private";
    isSpoiler: boolean;
    isJournal: boolean;
    shareRating: boolean;
    ratingValue?: number | null;
    sourceRating?: number | null;
    sourceScale?: number | null;
    viewingId?: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    author: {
      id: string;
      name: string;
      username: string | null;
      image: string | null;
    };
    mediaItem: {
      id: string;
      title: string;
      mediaType: string;
      overview: string | null;
      posterPath: string | null;
      backdropPath: string | null;
      stillPath: string | null;
      releaseDate: string | null;
      seasonNumber: number | null;
      episodeNumber: number | null;
    };
    rating: {
      id: string;
      score: number | null;
      tier: {
        id: string;
        name: string;
        color: string;
      } | null;
    } | null;
    stats: {
      likeCount: number;
      commentCount: number;
      isLiked: boolean;
    };
  };
  currentUserId?: string | null;
}

export function ReviewDetailClient({
  initialReview,
  currentUserId,
}: ReviewDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [review, setReview] = useState(initialReview);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(!initialReview.isSpoiler);
  const [copied, setCopied] = useState(false);

  const isAuthor = currentUserId === review.userId;
  const isDraftOrUnpublished = review.status !== "published";

  useEffect(() => {
    if (isAuthor && searchParams.get("edit") === "1") {
      setIsEditorOpen(true);
      router.replace(`/review/${review.id}`, { scroll: false });
    }
  }, [isAuthor, review.id, router, searchParams]);

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const formattedDate = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : review.status === "published" ? "Review date unknown" : "Unpublished Draft";

  const media = review.mediaItem;
  const isTv = media.mediaType === "tv" || media.mediaType === "episode" || Boolean(media.seasonNumber);
  const heroImage = media.stillPath
    ? getTmdbImageUrl(media.stillPath, "original")
    : media.backdropPath
      ? getTmdbImageUrl(media.backdropPath, "original")
      : media.posterPath
        ? resolvePosterUrl(media.posterPath, "original")
        : null;

  const posterUrl = media.posterPath ? resolvePosterUrl(media.posterPath, "w300") : null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 transition-colors">
      {/* Hero Banner Header */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden bg-card border-b border-border">
        {heroImage ? (
          <>
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover opacity-25 filter saturate-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-surface" />
        )}

        <div className="absolute top-6 left-4 sm:left-8 z-20">
          <Link
            href={getPublicMediaUrl(media.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-xs font-semibold text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to {media.title}</span>
          </Link>
        </div>

        {/* Media Title & Author Info inside Banner */}
        <div className="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 z-20 max-w-4xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
              {isTv ? "Television Review" : "Film Review"}
            </span>

            {review.visibility === "unlisted" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-muted-foreground">
                <Link2 size={10} />
                <span>Unlisted</span>
              </span>
            )}

            {review.visibility === "private" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-muted-foreground">
                <Lock size={10} />
                <span>Private</span>
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-4xl uppercase font-bold text-foreground tracking-tight line-clamp-2">
            Review: {media.title}
          </h1>
        </div>
      </div>

      {/* Main Review Reading Experience */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Draft Notice if owner is previewing draft/unpublished review */}
        {isDraftOrUnpublished && (
          <div className="p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {review.status === "draft" ? "Draft Review" : "Unpublished Review"}
                </p>
                <p className="text-xs text-muted-foreground">
                  This dispatch is private and only visible to you.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Pencil size={13} />
              <span>{review.status === "draft" ? "Publish Review" : "Republish"}</span>
            </button>
          </div>
        )}

        {/* Author Byline & Rating Meta */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Link
              href={review.author.username ? `/u/${review.author.username}` : "#"}
              className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center font-display font-bold text-foreground flex-shrink-0 hover:opacity-85 transition-opacity"
            >
              {review.author.image ? (
                <img
                  src={review.author.image}
                  alt={review.author.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (review.author.name || "U").charAt(0).toUpperCase()
              )}
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={review.author.username ? `/u/${review.author.username}` : "#"}
                  className="font-display text-sm uppercase font-bold text-foreground hover:text-primary-text transition-colors"
                >
                  {review.author.name}
                </Link>
                {review.author.username && (
                  <span className="text-xs text-muted-foreground">
                    @{review.author.username}
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar size={12} />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Score or Tier Badge */}
          {personalReviewScore(review) !== null && <div className="text-sm font-semibold text-primary-text">★ {personalReviewScore(review)?.toFixed(1)} / 10</div>}
          {personalReviewScore(review) === null && review.rating && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {review.rating.tier ? (
                <div
                  className="px-3 py-1 rounded-lg text-xs font-mono font-bold text-white shadow-sm flex items-center gap-1.5"
                  style={{ backgroundColor: review.rating.tier.color }}
                >
                  <span>Tier {review.rating.tier.name}</span>
                </div>
              ) : review.rating.score !== null ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-xs font-bold text-foreground">
                  <Star size={13} className="text-primary-text fill-primary-text" />
                  <span>★ {review.rating.score.toFixed(1)} / 10</span>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Article Body */}
        <article className="space-y-6">
          {review.title && (
            <h2 className="font-display text-2xl sm:text-3xl uppercase font-bold text-foreground tracking-tight leading-tight">
              {review.title}
            </h2>
          )}

          {/* Spoiler Guard */}
          {review.isSpoiler && !spoilerRevealed ? (
            <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                <EyeOff size={22} />
              </div>
              <h3 className="font-display text-lg uppercase font-bold text-foreground">
                Contains Spoilers
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                This review contains major plot details and twists. Proceed with discretion.
              </p>
              <button
                type="button"
                onClick={() => setSpoilerRevealed(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-raised border border-border hover:border-primary text-xs font-bold text-foreground transition-colors cursor-pointer"
              >
                <Eye size={13} />
                <span>Reveal Review</span>
              </button>
            </div>
          ) : (
            <MarkdownRenderer content={review.content} format={review.contentFormat} className="text-base sm:text-lg leading-relaxed text-foreground/90" />
          )}
        </article>

        {/* Social Actions Bar */}
        <section className="flex items-center justify-between pt-6 border-t border-border">
          <div className="flex items-center gap-3">
            <LikeButton
              reviewId={review.id}
              initialLikeCount={review.stats.likeCount}
              initialIsLiked={review.stats.isLiked}
            />

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-raised text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} className="text-primary" /> : <Share2 size={13} />}
              <span>{copied ? "Copied Link" : "Share"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor ? (
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-raised text-xs font-semibold text-foreground transition-colors cursor-pointer"
              >
                <Pencil size={13} />
                <span>Edit Review</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Flag size={13} />
                <span>Report</span>
              </button>
            )}
          </div>
        </section>

        {/* Threaded Comments & Discussion Section */}
        <section className="pt-8 border-t border-border">
          <CommentsSection reviewId={review.id} isOwner={isAuthor} />
        </section>
      </main>

      {/* Review Editor Dialog Modal */}
      <ReviewEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        mediaItemId={media.id}
        mediaTitle={media.title}
        posterPath={media.posterPath}
        existingReview={{
          id: review.id,
          title: review.title,
          content: review.content,
          draftContent: review.draftContent,
          contentFormat: review.contentFormat,
          draftContentFormat: review.draftContentFormat,
          status: review.status,
          visibility: review.visibility,
          isSpoiler: review.isSpoiler,
          isJournal: review.isJournal,
          shareRating: review.shareRating,
          ratingId: review.rating?.id || null,
          ratingValue: review.ratingValue,
          sourceRating: review.sourceRating,
          sourceScale: review.sourceScale,
          viewingId: review.viewingId,
        }}
        onSaved={(updated) => {
          setReview((prev) => ({
            ...prev,
            title: updated.title,
            content: updated.content,
            draftContent: updated.draftContent,
            contentFormat: updated.contentFormat,
            draftContentFormat: updated.draftContentFormat,
            status: updated.status,
            visibility: updated.visibility,
            isSpoiler: updated.isSpoiler,
            shareRating: updated.shareRating,
            ratingValue: updated.ratingValue,
            sourceRating: updated.sourceRating,
            sourceScale: updated.sourceScale,
            viewingId: updated.viewingId,
            publishedAt: updated.sourceService === "letterboxd" ? updated.sourceReviewDate : updated.publishedAt,
            updatedAt: updated.updatedAt,
          }));
        }}
        onDeleted={() => {
          router.push(getPublicMediaUrl(media.id));
        }}
      />

      {/* Report Modal */}
      <ReportDialog
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="review"
        targetId={review.id}
        targetTitle={review.title || `Review of ${media.title}`}
      />
    </div>
  );
}
