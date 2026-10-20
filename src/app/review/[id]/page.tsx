import { notFound } from "next/navigation";
import { db } from "@/db";
import { reviews, likes, comments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getServerSession } from "@/lib/server-session";
import { isBlocked } from "@/lib/safety";
import { ReviewDetailClient } from "./components/review-detail-client";
import { canShowReviewRating } from "@/lib/review-rating";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id: reviewId } = await params;
  if (!reviewId) {
    notFound();
  }

  const session = await getServerSession();

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
          tierId: true,
        },
        with: {
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
    notFound();
  }

  const isAuthor = session?.user?.id === review.userId;

  // Server-enforced privacy & authorization boundary
  if (!isAuthor) {
    // 1. Authoritative Block Check: Return indistinguishable 404
    if (session && (await isBlocked(review.userId, session.user.id))) {
      notFound();
    }

    // 2. Drafts, unpublished, and private reviews are strictly author-only
    if (review.status !== "published" || review.visibility === "private") {
      notFound();
    }
  }

  // Aggregate likes
  const likeCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.reviewId, reviewId));
  const likeCount = Number(likeCountRes[0]?.count || 0);

  // Aggregate comments
  const commentCountRes = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.reviewId, reviewId));
  const commentCount = Number(commentCountRes[0]?.count || 0);

  // Check viewer like status
  let isLiked = false;
  if (session) {
    const userLike = await db.query.likes.findFirst({
      where: (l, { and, eq }) =>
        and(eq(l.userId, session.user.id), eq(l.reviewId, reviewId)),
    });
    isLiked = Boolean(userLike);
  }

  const initialReview = {
    id: review.id,
    userId: review.userId,
    title: review.title,
    content: review.content,
    draftContent: isAuthor ? review.draftContent : null,
    contentFormat: review.contentFormat as "plain" | "markdown",
    draftContentFormat: isAuthor ? review.draftContentFormat as "plain" | "markdown" | null : null,
    status: review.status as any,
    visibility: review.visibility as any,
    isSpoiler: review.isSpoiler,
    isJournal: review.isJournal,
    shareRating: isAuthor ? review.shareRating : false,
    publishedAt: review.publishedAt ? review.publishedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    author: {
      id: review.user.id,
      name: review.user.name,
      username: review.user.username,
      image: review.user.image,
    },
    mediaItem: {
      id: review.mediaItem.id,
      title: review.mediaItem.title,
      mediaType: review.mediaItem.mediaType,
      overview: review.mediaItem.overview,
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
          score: review.rating.calculatedOverallScore ?? review.rating.sourceRating ?? null,
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
  };

  return (
    <ReviewDetailClient
      initialReview={initialReview}
      currentUserId={session?.user?.id}
    />
  );
}
