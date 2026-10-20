import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { reviews, likes, comments, user, mediaItems, ratings } from "@/db/schema";
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
      visibility: review.visibility,
      isSpoiler: review.isSpoiler,
      publishedAt: review.publishedAt,
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

  const { title, content, draftContent, contentFormat, draftContentFormat, status, visibility, isSpoiler, ratingId, shareRating } = body;
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
  if (newStatus === "published" && !publishedAt) {
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

  const now = new Date();
  await db
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
      updatedAt: now,
    })
    .where(eq(reviews.id, reviewId));

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

  await db.delete(reviews).where(eq(reviews.id, reviewId));

  return NextResponse.json({ success: true });
}
