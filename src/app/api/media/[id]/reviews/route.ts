import { NextRequest, NextResponse } from "next/server";
import { canShowReviewRating, reviewScoreOnTen, resolveReviewScoreOnTen } from "@/lib/review-rating";
import { getCommunityAverage } from "@/lib/community-rating";
import { db } from "@/db";
import { mediaItems, ratings, collections, user, reviews } from "@/db/schema";
import { eq, and, isNotNull, ne, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: mediaId } = await params;

  if (!mediaId) {
    return NextResponse.json({ error: "Media ID required" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedType = searchParams.get("type")?.toLowerCase();

  // Find media item by id, or fallback to tmdbId if numeric string
  let media: any = await db.query.mediaItems.findFirst({
    where: (m, { eq }) => eq(m.id, mediaId),
  });

  if (!media && /^\d+$/.test(mediaId)) {
    const tmdbNum = parseInt(mediaId, 10);
    if (requestedType === "movie" || requestedType === "tv") {
      media = await db.query.mediaItems.findFirst({
        where: (m, { eq, and }) =>
          and(eq(m.tmdbId, tmdbNum), eq(m.mediaType, requestedType)),
      });
    } else {
      media = await db.query.mediaItems.findFirst({
        where: (m, { eq }) => eq(m.tmdbId, tmdbNum),
      });
    }

    if (!media) {
      const { tmdb } = await import("@/lib/tmdb");
      try {
        if (requestedType === "tv") {
          const tv = await tmdb.getTvDetails(tmdbNum);
          if (tv && (tv.name || tv.id)) {
            media = {
              id: `tmdb-tv-${tv.id}`,
              tmdbId: tv.id,
              mediaType: "tv",
              title: tv.name || "Untitled Series",
              overview: tv.overview || null,
              posterPath: tv.poster_path || null,
              backdropPath: tv.backdrop_path || null,
              stillPath: null,
              releaseDate: tv.first_air_date || null,
              seasonNumber: null,
              episodeNumber: null,
            };
          }
        } else if (requestedType === "movie") {
          const movie = await tmdb.getMovieDetails(tmdbNum);
          if (movie && (movie.title || movie.id)) {
            media = {
              id: `tmdb-movie-${movie.id}`,
              tmdbId: movie.id,
              mediaType: "movie",
              title: movie.title || "Untitled Film",
              overview: movie.overview || null,
              posterPath: movie.poster_path || null,
              backdropPath: movie.backdrop_path || null,
              stillPath: null,
              releaseDate: movie.release_date || null,
              seasonNumber: null,
              episodeNumber: null,
            };
          }
        } else {
          try {
            const movie = await tmdb.getMovieDetails(tmdbNum);
            if (movie && (movie.title || movie.id)) {
              media = {
                id: `tmdb-movie-${movie.id}`,
                tmdbId: movie.id,
                mediaType: "movie",
                title: movie.title || "Untitled Film",
                overview: movie.overview || null,
                posterPath: movie.poster_path || null,
                backdropPath: movie.backdrop_path || null,
                stillPath: null,
                releaseDate: movie.release_date || null,
                seasonNumber: null,
                episodeNumber: null,
              };
            }
          } catch {
            const tv = await tmdb.getTvDetails(tmdbNum);
            if (tv && (tv.name || tv.id)) {
              media = {
                id: `tmdb-tv-${tv.id}`,
                tmdbId: tv.id,
                mediaType: "tv",
                title: tv.name || "Untitled Series",
                overview: tv.overview || null,
                posterPath: tv.poster_path || null,
                backdropPath: tv.backdrop_path || null,
                stillPath: null,
                releaseDate: tv.first_air_date || null,
                seasonNumber: null,
                episodeNumber: null,
              };
            }
          }
        }
      } catch {}
    }
  }

  if (!media) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  // Fetch all public ratings with reviews for this media item (if media exists in DB)
  const isEphemeral = typeof media.id === "string" && media.id.startsWith("tmdb-");

  const session = await (await import("@/lib/server-session")).getServerSession(request);
  const { getBlockedUserIds } = await import("@/lib/safety");
  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  // 1. Fetch published, public first-class reviews
  const rawFirstClassReviews = isEphemeral
    ? []
    : await db.query.reviews.findMany({
        where: (rv, { and, eq }) =>
          and(
            eq(rv.mediaItemId, media.id),
            eq(rv.status, "published"),
            eq(rv.visibility, "public")
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
          rating: {
            columns: {
              id: true,
              calculatedOverallScore: true,
              sourceRating: true,
              sourceScale: true,
              sourceService: true,
              ratingSystemId: true,
              tierId: true,
              collectionId: true,
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

  const firstClassReviews = rawFirstClassReviews
    .filter((r) => !blockedUserIds.has(r.userId))
    .map((r) => ({
      id: r.id,
      reviewType: "independent" as const,
      title: r.title,
      reviewText: r.content,
      contentFormat: r.contentFormat,
      score: canShowReviewRating(r) ? resolveReviewScoreOnTen(r) : null,
      scale: 10,
      tier: canShowReviewRating(r) && r.rating?.tier
        ? {
            id: r.rating.tier.id,
            name: r.rating.tier.name,
            color: r.rating.tier.color,
          }
        : null,
      isSpoiler: r.isSpoiler,
      watchDate: null,
      sourceService: r.sourceService,
      sourceReviewDate: r.sourceReviewDate,
      publishedAt: r.sourceService === "letterboxd" ? r.sourceReviewDate : r.publishedAt,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
      author: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username,
        image: r.user.image,
      },
      collection: null,
    }));

  const reviewsList = firstClassReviews;
  const community = await getCommunityAverage(media.id, blockedUserIds);
  const averageScore = community ? community.average.toFixed(1) : null;

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
    reviews: reviewsList,
    stats: {
      totalReviews: reviewsList.length,
      averageScore,
      starsAverage: community ? community.starsAverage : null,
      totalRatings: community ? community.count : 0,
      distribution: community ? community.distribution : null,
    },
  });
}
