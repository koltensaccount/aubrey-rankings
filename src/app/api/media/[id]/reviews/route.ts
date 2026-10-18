import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems, ratings, collections, user } from "@/db/schema";
import { eq, and, isNotNull, ne, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: mediaId } = await params;

  if (!mediaId) {
    return NextResponse.json({ error: "Media ID required" }, { status: 400 });
  }

  // Find media item by id, or fallback to tmdbId if numeric string
  let media = await db.query.mediaItems.findFirst({
    where: (m, { eq }) => eq(m.id, mediaId),
  });

  if (!media && /^\d+$/.test(mediaId)) {
    const tmdbNum = parseInt(mediaId, 10);
    media = await db.query.mediaItems.findFirst({
      where: (m, { eq }) => eq(m.tmdbId, tmdbNum),
    });
  }

  if (!media) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  // Fetch all public ratings with reviews for this media item
  const rawReviews = await db.query.ratings.findMany({
    where: (r, { and, eq, isNotNull, ne }) =>
      and(
        eq(r.mediaItemId, media.id),
        isNotNull(r.reviewText),
        ne(r.reviewText, ""),
        isNotNull(r.collectionId)
      ),
    orderBy: [desc(ratings.updatedAt)],
    columns: {
      personalNotes: false, // Strict privacy: Never expose private notes
    },
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      collection: {
        columns: {
          id: true,
          title: true,
          visibility: true,
        },
      },
      ratingSystem: {
        columns: {
          scale: true,
        },
      },
    },
  });

  // Filter to reviews in public collections only (excluding unlisted and private)
  const publicReviews = rawReviews
    .filter((r) => r.collection && r.collection.visibility === "public")
    .map((r) => ({
      id: r.id,
      reviewText: r.reviewText,
      score: r.calculatedOverallScore ?? r.sourceRating ?? null,
      scale: r.ratingSystem?.scale ?? 10,
      watchDate: r.watchDate,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
      collection: {
        id: r.collection!.id,
        title: r.collection!.title,
      },
    }));

  const scores = publicReviews
    .map((r) => r.score)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));

  const averageScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

  return NextResponse.json({
    mediaItem: {
      id: media.id,
      title: media.title,
      overview: media.overview,
      mediaType: media.mediaType,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      stillPath: media.stillPath,
      releaseDate: media.releaseDate,
      seasonNumber: media.seasonNumber,
      episodeNumber: media.episodeNumber,
    },
    reviews: publicReviews,
    stats: {
      totalReviews: publicReviews.length,
      averageScore,
    },
  });
}
