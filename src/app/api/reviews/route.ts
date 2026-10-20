import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { reviews, mediaItems, user, ratings, ratingTiers } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireRateLimit } from "@/lib/request-limits";
import { getBlockedUserIds } from "@/lib/safety";
import { tmdb } from "@/lib/tmdb";
import { canShowReviewRating, reviewScoreOnTen } from "@/lib/review-rating";

export const dynamic = "force-dynamic";

const isContentFormat = (value: unknown): value is "plain" | "markdown" =>
  value === "plain" || value === "markdown";

export async function resolveMediaItem(mediaId: string): Promise<string | null> {
  // 1. Direct DB lookup by id
  const existing = await db.query.mediaItems.findFirst({
    where: eq(mediaItems.id, mediaId),
    columns: { id: true },
  });
  if (existing) return existing.id;

  // 2. Check for TV episode synthetic or target IDs (e.g. tv_1399_s1_e1 or tmdb-tv-1399-s1-e1 or tmdb-episode-1399-1-1)
  const episodeMatch =
    /^(?:tmdb[-_])?tv[-_](\d+)[-_]s(\d+)[-_]e(\d+)$/i.exec(mediaId) ||
    /^(?:tmdb[-_])?episode[-_](\d+)[-_](\d+)[-_](\d+)$/i.exec(mediaId);

  if (episodeMatch) {
    const tvId = parseInt(episodeMatch[1], 10);
    const seasonNumber = parseInt(episodeMatch[2], 10);
    const episodeNumber = parseInt(episodeMatch[3], 10);
    const targetEpisodeId = `tv_${tvId}_s${seasonNumber}_e${episodeNumber}`;

    const existingEp = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, targetEpisodeId),
      columns: { id: true },
    });
    if (existingEp) return existingEp.id;

    try {
      const seasonData = await tmdb.getTvSeason(tvId, seasonNumber);
      const ep = seasonData.episodes?.find((e) => e.episode_number === episodeNumber);
      if (ep) {
        // 1. First look for an existing series by canonical ID or TMDB identity
        let parentRecord = await db.query.mediaItems.findFirst({
          where: (m, { and, eq, or }) =>
            or(eq(m.id, `tv_${tvId}`), and(eq(m.tmdbId, tvId), eq(m.mediaType, "tv"))),
          columns: { id: true },
        });

        // 2. If not found in DB, try to fetch and create parent show from TMDB
        if (!parentRecord) {
          try {
            const tv = await tmdb.getTvDetails(tvId);
            if (tv && (tv.name || tv.id)) {
              const canonicalParentId = `tv_${tv.id}`;
              await db
                .insert(mediaItems)
                .values({
                  id: canonicalParentId,
                  tmdbId: tv.id,
                  mediaType: "tv",
                  title: tv.name || "Untitled Series",
                  overview: tv.overview || null,
                  posterPath: tv.poster_path || null,
                  backdropPath: tv.backdrop_path || null,
                  releaseDate: tv.first_air_date || null,
                  tmdbMetadata: { voteAverage: tv.vote_average, voteCount: tv.vote_count },
                })
                .onConflictDoNothing();

              // Confirm parent record exists in DB
              parentRecord = await db.query.mediaItems.findFirst({
                where: eq(mediaItems.id, canonicalParentId),
                columns: { id: true },
              });
            }
          } catch {
            // Parent fetch failed; continue safely without parentMediaId
          }
        }

        // 3. Only set parentMediaId when the referenced parent actually exists in the DB
        const verifiedParentId = parentRecord ? parentRecord.id : null;

        await db
          .insert(mediaItems)
          .values({
            id: targetEpisodeId,
            tmdbId: ep.id,
            mediaType: "episode",
            title: ep.name || `Episode ${ep.episode_number}`,
            overview: ep.overview || null,
            stillPath: ep.still_path || null,
            posterPath: ep.still_path || null,
            releaseDate: ep.air_date || null,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            parentMediaId: verifiedParentId,
            tmdbMetadata: {
              voteAverage: ep.vote_average,
            },
          })
          .onConflictDoNothing();

        return targetEpisodeId;
      }
    } catch {}

    return null;
  }

  // 3. TMDB ephemeral synthetic ID or numeric ID
  let tmdbNum: number | null = null;
  let mediaType: "movie" | "tv" = "movie";

  const tvShowMatch = /^(?:tmdb[-_])?tv[-_]?(\d+)$/i.exec(mediaId);
  const movieMatch = /^(?:tmdb[-_])?movie[-_]?(\d+)$/i.exec(mediaId);

  if (tvShowMatch) {
    tmdbNum = parseInt(tvShowMatch[1], 10);
    mediaType = "tv";
  } else if (movieMatch) {
    tmdbNum = parseInt(movieMatch[1], 10);
    mediaType = "movie";
  } else if (/^\d+$/.test(mediaId)) {
    tmdbNum = parseInt(mediaId, 10);
    mediaType = "movie";
  }

  if (!tmdbNum || isNaN(tmdbNum)) return null;

  // Check if exists by tmdbId and mediaType
  const byTmdb = await db.query.mediaItems.findFirst({
    where: (m, { and, eq }) => and(eq(m.tmdbId, tmdbNum), eq(m.mediaType, mediaType)),
    columns: { id: true },
  });
  if (byTmdb) return byTmdb.id;

  // Fetch from TMDB and persist
  try {
    if (mediaType === "tv") {
      const tv = await tmdb.getTvDetails(tmdbNum);
      if (tv && (tv.name || tv.id)) {
        const id = `tv_${tv.id}`;
        await db
          .insert(mediaItems)
          .values({
            id,
            tmdbId: tv.id,
            mediaType: "tv",
            title: tv.name || "Untitled Series",
            overview: tv.overview || null,
            posterPath: tv.poster_path || null,
            backdropPath: tv.backdrop_path || null,
            releaseDate: tv.first_air_date || null,
            tmdbMetadata: { voteAverage: tv.vote_average, voteCount: tv.vote_count },
          })
          .onConflictDoNothing();
        return id;
      }
    } else {
      const movie = await tmdb.getMovieDetails(tmdbNum);
      if (movie && (movie.title || movie.id)) {
        const id = `movie_${movie.id}`;
        await db
          .insert(mediaItems)
          .values({
            id,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title || "Untitled Film",
            overview: movie.overview || null,
            posterPath: movie.poster_path || null,
            backdropPath: movie.backdrop_path || null,
            releaseDate: movie.release_date || null,
            tmdbMetadata: {
              voteAverage: movie.vote_average,
            voteCount: movie.vote_count,
              runtime: movie.runtime,
            },
          })
          .onConflictDoNothing();
        return id;
      }
    }
  } catch {}

  return null;
}

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
      publishedAt: r.publishedAt,
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

  const { mediaItemId, title, content, draftContent, contentFormat, draftContentFormat, status, visibility, isSpoiler, ratingId } = body;

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

  const reviewId = `rev_${randomUUID()}`;
  const now = new Date();
  const publishedAt = reviewStatus === "published" ? now : null;

  await db.insert(reviews).values({
    id: reviewId,
    userId: session.user.id,
    mediaItemId: resolvedMediaId,
    ratingId: validRatingId,
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
