import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { tmdb } from "@/lib/tmdb";
import { eq } from "drizzle-orm";

export function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Resolves a media item ID (canonical, synthetic, TMDB-prefixed, or plain numeric)
 * to a persisted `media_items` primary key.
 *
 * For TV episodes that do not yet exist in the DB, it safely fetches and persists
 * both the episode and its parent TV series to satisfy the parentMediaId foreign key.
 */
export async function resolveMediaItem(mediaId: string): Promise<string | null> {
  if (!mediaId || typeof mediaId !== "string") return null;
  const decodedId = safeDecodeURIComponent(mediaId.trim());

  // 1. Direct DB lookup by exact id or decoded id
  const existing = await db.query.mediaItems.findFirst({
    where: (m, { eq, or }) => or(eq(m.id, mediaId), eq(m.id, decodedId)),
    columns: { id: true },
  });
  if (existing) return existing.id;

  // 2. Check for TV episode synthetic or target IDs (e.g. tv_1399_s1_e1 or tmdb-tv-1399-s1-e1 or tmdb-episode-1399-1-1)
  const episodeMatch =
    /^(?:tmdb[-_])?tv[-_](\d+)[-_]s(\d+)[-_]e(\d+)$/i.exec(decodedId) ||
    /^(?:tmdb[-_])?episode[-_](\d+)[-_](\d+)[-_](\d+)$/i.exec(decodedId);

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
        // First look for an existing series by canonical ID or TMDB identity
        let parentRecord = await db.query.mediaItems.findFirst({
          where: (m, { and, eq, or }) =>
            or(eq(m.id, `tv_${tvId}`), and(eq(m.tmdbId, tvId), eq(m.mediaType, "tv"))),
          columns: { id: true },
        });

        // If not found in DB, fetch and create parent show from TMDB
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

        // Only set parentMediaId when the referenced parent actually exists in the DB
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

  const tvShowMatch = /^(?:tmdb[-_])?tv[-_]?(\d+)$/i.exec(decodedId);
  const movieMatch = /^(?:tmdb[-_])?movie[-_]?(\d+)$/i.exec(decodedId);

  if (tvShowMatch) {
    tmdbNum = parseInt(tvShowMatch[1], 10);
    mediaType = "tv";
  } else if (movieMatch) {
    tmdbNum = parseInt(movieMatch[1], 10);
    mediaType = "movie";
  } else if (/^\d+$/.test(decodedId)) {
    tmdbNum = parseInt(decodedId, 10);
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
