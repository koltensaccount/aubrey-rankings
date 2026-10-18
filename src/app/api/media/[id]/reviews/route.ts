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
  const rawReviews = isEphemeral
    ? []
    : await db.query.ratings.findMany({
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

  const session = await (await import("@/lib/server-session")).getServerSession(request);
  const { getBlockedUserIds } = await import("@/lib/safety");
  const blockedUserIds = session ? await getBlockedUserIds(session.user.id) : new Set<string>();

  // Filter to reviews in public collections only (excluding unlisted and private) and not blocked
  const publicReviews = rawReviews
    .filter(
      (r) =>
        r.collection &&
        r.collection.visibility === "public" &&
        !blockedUserIds.has(r.userId)
    )
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
