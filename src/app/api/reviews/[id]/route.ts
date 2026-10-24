import { validReviewScoreInput } from "@/lib/review-rating";
import { syncReviewActivity } from "@/lib/activity-sync";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { reviews, likes, comments, user, mediaItems, ratings, activityEvents, diaryEntries } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { isBlocked } from "@/lib/safety";
import { canShowReviewRating, reviewScoreOnTen } from "@/lib/review-rating";

export const dynamic = "force-dynamic";

const isContentFormat = (value: unknown): value is "plain" | "markdown" =>
  value === "plain" || value === "markdown";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  const session = await getServerSession(request);

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      mediaItem: true,
      rating: {
        columns: {
          id: true,
          calculatedOverallScore: true,
          sourceRating: true,
          sourceScale: true,
          sourceService: true,
          ratingSystemId: true,
          tierId: true,
        },
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: { columns: { id: true } },
          tier: {
            columns: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const isAuthor = session?.user?.id === review.userId;

  // Authorization & Privacy boundary
  if (!isAuthor) {
    // 1. Authoritative Block check: returns 404 indistinguishable from non-existence
    if (session && (await isBlocked(review.userId, session.user.id))) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // 2. Drafts, unpublished, and private reviews are strictly author-only
    if (review.status !== "published" || review.visibility === "private") {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    // Note: 'unlisted' reviews are accessible via direct permalink (intended sharing path)
  }

  // Get likes count
  const likeCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.reviewId, reviewId));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  // Get comments count
  const commentCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.reviewId, reviewId));
  const commentCount = Number(commentCountRes[0]?.count || 0);

  // Check if current viewer liked this review
  let isLiked = false;
  if (session) {
    const existingLike = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, session.user.id), eq(l.reviewId, reviewId)),
    });
    isLiked = Boolean(existingLike);
  }

  return NextResponse.json({
    review: {
      id: review.id,
      title: review.title,
      content: review.content,
      draftContent: isAuthor ? review.draftContent : null,
      contentFormat: review.contentFormat,
      draftContentFormat: isAuthor ? review.draftContentFormat : null,
      status: review.status,
      isJournal: review.isJournal,
      shareRating: isAuthor ? review.shareRating : false,
      ratingId: isAuthor ? review.ratingId : null,
      visibility: review.visibility,
      isSpoiler: review.isSpoiler,
      ratingValue: review.ratingValue,
      sourceRating: review.sourceRating,
      sourceScale: review.sourceScale,
      viewingId: review.viewingId,
      publishedAt: review.sourceService === "letterboxd" ? (review.sourceReviewDate ? new Date(review.sourceReviewDate) : null) : review.publishedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: {
        id: review.user.id,
        name: review.user.name,
        username: review.user.username,
        image: review.user.image,
      },
      mediaItem: {
        id: review.mediaItem.id,
        title: review.mediaItem.title,
        overview: review.mediaItem.overview,
        mediaType: review.mediaItem.mediaType,
        posterPath: review.mediaItem.posterPath,
        backdropPath: review.mediaItem.backdropPath,
        stillPath: review.mediaItem.stillPath,
        releaseDate: review.mediaItem.releaseDate,
        seasonNumber: review.mediaItem.seasonNumber,
        episodeNumber: review.mediaItem.episodeNumber,
      },
      rating: review.rating && canShowReviewRating(review, session?.user.id)
        ? {
            id: review.rating.id,
            score: reviewScoreOnTen(review.rating),
            tier: review.rating.tier
              ? {
                  id: review.rating.tier.id,
                  name: review.rating.tier.name,
                  color: review.rating.tier.color,
                }
              : null,
          }
        : null,
      stats: {
        likeCount,
        commentCount,
        isLiked,
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden: Not review author" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const {
    title,
    content,
    draftContent,
    contentFormat,
    draftContentFormat,
    status,
    visibility,
    isSpoiler,
    ratingId,
    shareRating,
    ratingValue,
    sourceRating,
    sourceScale,
    viewingId,
  } = body;
  if (!validReviewScoreInput({ ratingValue, sourceRating, sourceScale })) return NextResponse.json({ error: "Invalid review score or source scale" }, { status: 400 });
  if (shareRating !== undefined && typeof shareRating !== "boolean") return NextResponse.json({ error: "Invalid rating sharing choice" }, { status: 400 });

  const validStatuses = ["draft", "published", "unpublished"];
  const newStatus = status && validStatuses.includes(status) ? status : review.status;

  const validVisibilities = ["public", "unlisted", "private"];
  const newVisibility = visibility && validVisibilities.includes(visibility) ? visibility : review.visibility;

  // Determine updated content
  let newContent = review.content;
  let newDraftContent = review.draftContent;
  let newContentFormat = review.contentFormat;
  let newDraftContentFormat = review.draftContentFormat;

  if ((contentFormat !== undefined && !isContentFormat(contentFormat)) ||
      (draftContentFormat !== undefined && draftContentFormat !== null && !isContentFormat(draftContentFormat))) {
    return NextResponse.json({ error: "Invalid review content format" }, { status: 400 });
  }

  if (typeof content === "string") {
    newContent = content;
    if (isContentFormat(contentFormat)) newContentFormat = contentFormat;
  }
  if (typeof draftContent === "string" || draftContent === null) {
    newDraftContent = draftContent;
    newDraftContentFormat = typeof draftContent === "string"
      ? (isContentFormat(draftContentFormat) ? draftContentFormat : newContentFormat)
      : null;
  }

  // If publishing or republishing: ensure content is valid
  if (newStatus === "published") {
    // If user published while editing draftContent, promote draftContent if provided
    if (body.commitDraft && newDraftContent) {
      newContent = newDraftContent;
      newContentFormat = newDraftContentFormat || newContentFormat;
      newDraftContent = null;
      newDraftContentFormat = null;
    }
    if (!newContent.trim()) {
      return NextResponse.json({ error: "Review content cannot be empty when published" }, { status: 400 });
    }
  }

  let publishedAt = review.publishedAt;
  if (newStatus === "published" && !publishedAt && review.status !== "published") {
    publishedAt = new Date();
  }

  // Rating link update if supplied
  let newRatingId = review.ratingId;
  if (ratingId !== undefined) {
    if (ratingId === null) {
      newRatingId = null;
    } else if (typeof ratingId === "string") {
      const r = await db.query.ratings.findFirst({
        where: (r, { and, eq }) =>
          and(eq(r.id, ratingId), eq(r.userId, session.user.id), eq(r.mediaItemId, review.mediaItemId)),
        columns: { id: true },
      });
      if (r) newRatingId = r.id;
    }
  }

  // Viewing link update if supplied
  let newViewingId = review.viewingId;
  if (viewingId !== undefined) {
    if (viewingId === null) {
      newViewingId = null;
    } else if (typeof viewingId === "string") {
      const v = await db.query.diaryEntries.findFirst({
        where: (d, { and, eq }) =>
          and(eq(d.id, viewingId), eq(d.userId, session.user.id), eq(d.mediaItemId, review.mediaItemId)),
        columns: { id: true },
      });
      if (v) newViewingId = v.id;
    }
  }

  // Direct review rating updates
  let newSourceRating = review.sourceRating;
  let newSourceScale = review.sourceScale;
  let newRatingValue = review.ratingValue;

  if (sourceRating !== undefined) {
    newSourceRating = typeof sourceRating === "number" && !isNaN(sourceRating) ? sourceRating : null;
    newSourceScale = typeof sourceScale === "number" && sourceScale > 0 ? sourceScale : (newSourceRating !== null ? 5 : null);
    newRatingValue = newSourceRating !== null && newSourceScale ? (newSourceRating / newSourceScale) * 10 : null;
  } else if (ratingValue !== undefined) {
    newRatingValue = typeof ratingValue === "number" && !isNaN(ratingValue) ? ratingValue : null;
    newSourceRating = null;
    newSourceScale = null;
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const [saved] = await tx
    .update(reviews)
    .set({
      title: title !== undefined ? (typeof title === "string" && title.trim() ? title.trim() : null) : review.title,
      content: newContent,
      draftContent: newDraftContent,
      contentFormat: newContentFormat,
      draftContentFormat: newDraftContentFormat,
      status: newStatus,
      visibility: newVisibility,
      isSpoiler: typeof isSpoiler === "boolean" ? isSpoiler : review.isSpoiler,
      shareRating: review.isJournal && typeof shareRating === "boolean" ? shareRating : review.shareRating,
      publishedAt,
      ratingId: newRatingId,
      viewingId: newViewingId,
      ratingValue: newRatingValue,
      sourceRating: newSourceRating,
      sourceScale: newSourceScale,
      updatedAt: now,
    })
    .where(eq(reviews.id, reviewId)).returning();
    await syncReviewActivity(saved, tx);
  });

  const updated = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      mediaItem: true,
      rating: {
        columns: {
          id: true,
          calculatedOverallScore: true,
          sourceRating: true,
          sourceScale: true,
          sourceService: true,
          ratingSystemId: true,
          tierId: true,
        },
        with: {
          ratingSystem: { columns: { scale: true, type: true } },
          categoryScores: { columns: { id: true } },
          tier: {
            columns: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ review: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;
  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    columns: { id: true, userId: true },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden: Not review author" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.update(diaryEntries).set({ reviewId: null }).where(eq(diaryEntries.reviewId, reviewId));
    await tx.delete(activityEvents).where(and(eq(activityEvents.reviewId, reviewId), eq(activityEvents.userId, session.user.id), eq(activityEvents.eventType, "review")));
    await tx.update(activityEvents).set({ reviewId: null }).where(and(eq(activityEvents.reviewId, reviewId), eq(activityEvents.userId, session.user.id)));
    await tx.delete(reviews).where(eq(reviews.id, reviewId));
  });

  return NextResponse.json({ success: true });
}
