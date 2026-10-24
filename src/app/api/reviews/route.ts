import { syncReviewActivity } from "@/lib/activity-sync";
import { validReviewScoreInput } from "@/lib/review-rating";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { reviews, mediaItems, user, ratings, ratingTiers, diaryEntries } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireRateLimit } from "@/lib/request-limits";
import { getBlockedUserIds } from "@/lib/safety";
import { tmdb } from "@/lib/tmdb";
import { canShowReviewRating, reviewScoreOnTen } from "@/lib/review-rating";

export const dynamic = "force-dynamic";

const isContentFormat = (value: unknown): value is "plain" | "markdown" =>
  value === "plain" || value === "markdown";

import { resolveMediaItem } from "@/lib/media-resolution";
export { resolveMediaItem };

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const searchParams = request.nextUrl.searchParams;
  const mediaItemId = searchParams.get("mediaItemId");
  const targetUserId = searchParams.get("userId");
  const requestedStatus = searchParams.get("status");
  const requestedVisibility = searchParams.get("visibility");

  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  const isOwnQuery = Boolean(session && targetUserId && session.user.id === targetUserId);

  let statusFilter: ("draft" | "published" | "unpublished")[] = ["published"];
  let visibilityFilter: ("public" | "unlisted" | "private")[] = ["public"];

  if (isOwnQuery) {
    if (requestedStatus && ["draft", "published", "unpublished"].includes(requestedStatus)) {
      statusFilter = [requestedStatus as any];
    } else {
      statusFilter = ["draft", "published", "unpublished"];
    }

    if (requestedVisibility && ["public", "unlisted", "private"].includes(requestedVisibility)) {
      visibilityFilter = [requestedVisibility as any];
    } else {
      visibilityFilter = ["public", "unlisted", "private"];
    }
  }

  // Fetch reviews from database
  const rawReviews = await db.query.reviews.findMany({
    where: (r, { and, eq, inArray }) =>
      and(
        mediaItemId ? eq(r.mediaItemId, mediaItemId) : undefined,
        targetUserId ? eq(r.userId, targetUserId) : undefined,
        inArray(r.status, statusFilter),
        inArray(r.visibility, visibilityFilter)
      ),
    orderBy: [desc(reviews.publishedAt), desc(reviews.createdAt)],
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

  // Filter out blocked users
  const visibleReviews = rawReviews.filter((r) => !blockedUserIds.has(r.userId));

  return NextResponse.json({
    reviews: visibleReviews.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      draftContent: isOwnQuery ? r.draftContent : null,
      contentFormat: r.contentFormat,
      draftContentFormat: isOwnQuery ? r.draftContentFormat : null,
      status: r.status,
      visibility: r.visibility,
      isSpoiler: r.isSpoiler,
      ratingValue: r.ratingValue,
      sourceRating: r.sourceRating,
      sourceScale: r.sourceScale,
      viewingId: r.viewingId,
      publishedAt: r.sourceService === "letterboxd" ? (r.sourceReviewDate ? new Date(r.sourceReviewDate) : null) : r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
      mediaItem: {
        id: r.mediaItem.id,
        title: r.mediaItem.title,
        overview: r.mediaItem.overview,
        mediaType: r.mediaItem.mediaType,
        posterPath: r.mediaItem.posterPath,
        backdropPath: r.mediaItem.backdropPath,
        stillPath: r.mediaItem.stillPath,
        releaseDate: r.mediaItem.releaseDate,
        seasonNumber: r.mediaItem.seasonNumber,
        episodeNumber: r.mediaItem.episodeNumber,
      },
      rating: r.rating && canShowReviewRating(r, session?.user.id)
        ? {
            id: r.rating.id,
            score: reviewScoreOnTen(r.rating),
            tier: r.rating.tier
              ? {
                  id: r.rating.tier.id,
                  name: r.rating.tier.name,
                  color: r.rating.tier.color,
                }
              : null,
          }
        : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`reviews:${session.user.id}`, 30);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const {
    mediaItemId,
    title,
    content,
    draftContent,
    contentFormat,
    draftContentFormat,
    status,
    visibility,
    isSpoiler,
    ratingId,
    ratingValue,
    sourceRating,
    sourceScale,
    viewingId,
  } = body;
  if (!validReviewScoreInput({ ratingValue, sourceRating, sourceScale })) return NextResponse.json({ error: "Invalid review score or source scale" }, { status: 400 });

  if (!mediaItemId || typeof mediaItemId !== "string") {
    return NextResponse.json({ error: "mediaItemId is required" }, { status: 400 });
  }

  if ((contentFormat !== undefined && !isContentFormat(contentFormat)) ||
      (draftContentFormat !== undefined && draftContentFormat !== null && !isContentFormat(draftContentFormat))) {
    return NextResponse.json({ error: "Invalid review content format" }, { status: 400 });
  }

  const resolvedMediaId = await resolveMediaItem(mediaItemId);
  if (!resolvedMediaId) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  const reviewStatus = status === "published" ? "published" : "draft";

  // Validate content when publishing
  const finalContent = typeof content === "string" ? content : typeof draftContent === "string" ? draftContent : "";
  if (reviewStatus === "published" && !finalContent.trim()) {
    return NextResponse.json({ error: "Review content cannot be empty when publishing" }, { status: 400 });
  }

  // Fetch author preferences for default fallback
  const authorUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { defaultReviewVisibility: true, defaultReviewSpoiler: true },
  });

  const validVisibilities = ["public", "unlisted", "private"];
  const reviewVisibility =
    visibility && validVisibilities.includes(visibility)
      ? visibility
      : authorUser?.defaultReviewVisibility && validVisibilities.includes(authorUser.defaultReviewVisibility)
        ? authorUser.defaultReviewVisibility
        : "public";

  const reviewSpoiler =
    typeof isSpoiler === "boolean"
      ? isSpoiler
      : authorUser?.defaultReviewSpoiler ?? false;

  // Explicit rating attachment only: validate ownership if supplied
  let validRatingId: string | null = null;
  if (ratingId && typeof ratingId === "string") {
    const existingRating = await db.query.ratings.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.id, ratingId), eq(r.userId, session.user.id), eq(r.mediaItemId, resolvedMediaId)),
      columns: { id: true },
    });
    if (!existingRating) {
      return NextResponse.json({ error: "Invalid ratingId or unauthorized" }, { status: 400 });
    }
    validRatingId = existingRating.id;
  }

  // Validate viewing attachment if supplied
  let validViewingId: string | null = null;
  if (viewingId && typeof viewingId === "string") {
    const existingViewing = await db.query.diaryEntries.findFirst({
      where: (d, { and, eq }) =>
        and(eq(d.id, viewingId), eq(d.userId, session.user.id), eq(d.mediaItemId, resolvedMediaId)),
      columns: { id: true },
    });
    if (existingViewing) {
      validViewingId = existingViewing.id;
    }
  }

  // Calculate normalized rating if source rating provided
  const parsedSourceRating = typeof sourceRating === "number" && !isNaN(sourceRating) ? sourceRating : null;
  const parsedSourceScale = typeof sourceScale === "number" && sourceScale > 0 ? sourceScale : (parsedSourceRating !== null ? 5 : null);
  const parsedRatingValue = typeof ratingValue === "number" && !isNaN(ratingValue)
    ? ratingValue
    : (parsedSourceRating !== null && parsedSourceScale
      ? (parsedSourceRating / parsedSourceScale) * 10
      : null);

  const reviewId = `rev_${randomUUID()}`;
  const now = new Date();
  const publishedAt = reviewStatus === "published" ? now : null;

  await db.transaction(async (tx) => {
    const [saved] = await tx.insert(reviews).values({
    id: reviewId,
    userId: session.user.id,
    mediaItemId: resolvedMediaId,
    ratingId: validRatingId,
    viewingId: validViewingId,
    ratingValue: parsedRatingValue,
    sourceRating: parsedSourceRating,
    sourceScale: parsedSourceScale,
    title: typeof title === "string" && title.trim() ? title.trim() : null,
    content: finalContent,
    draftContent: typeof draftContent === "string" ? draftContent : null,
    contentFormat: isContentFormat(contentFormat) ? contentFormat : "markdown",
    draftContentFormat: typeof draftContent === "string"
      ? (isContentFormat(draftContentFormat) ? draftContentFormat : isContentFormat(contentFormat) ? contentFormat : "markdown")
      : null,
    status: reviewStatus,
    visibility: reviewVisibility,
    isSpoiler: reviewSpoiler,
    publishedAt,
    createdAt: now,
    updatedAt: now,
    }).returning();

    await syncReviewActivity(saved, tx);
  });

  const created = await db.query.reviews.findFirst({
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

  return NextResponse.json({ review: created }, { status: 201 });
}
