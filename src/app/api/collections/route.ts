import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import {
  collections,
  collectionEntries,
  mediaItems,
  ratingSystems,
} from "@/db/schema";
import { tmdb } from "@/lib/tmdb";
import { nanoid } from "@/lib/utils";
import { eq, desc, and } from "drizzle-orm";
import { seedDefaultRatingSystem } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userCollections = await db.query.collections.findMany({
      where: (c, { eq }) => eq(c.userId, session.user.id),
      orderBy: [desc(collections.isPinned), desc(collections.updatedAt)],
      with: {
        entries: {
          with: {
            mediaItem: true,
          },
        },
        defaultRatingSystem: true,
      },
    });

    return NextResponse.json(userCollections);
  } catch (error: any) {
    console.error("[Get Collections Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      collectionType, // 'tv_show' | 'movie_franchise' | 'custom'
      tmdbId,
      importAllEpisodes,
      selectedSeasonNumbers,
    } = body;

    if (!title || !collectionType) {
      return NextResponse.json(
        { error: "Title and collectionType are required" },
        { status: 400 }
      );
    }

    // Find or seed default rating system for this user
    let defaultRs = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.userId, session.user.id), eq(rs.isDefault, true)),
    });

    let defaultRatingSystemId = defaultRs?.id;
    if (!defaultRatingSystemId) {
      defaultRatingSystemId = await seedDefaultRatingSystem(session.user.id);
    }

    const collectionId = `col_${Date.now()}_${nanoid(6)}`;
    let customCoverImage: string | null = null;
    let backdropImage: string | null = null;

    // A. TV SHOW IMPORT
    if (collectionType === "tv_show" && tmdbId) {
      const showDetails = await tmdb.getTvDetails(Number(tmdbId));
      customCoverImage = showDetails.poster_path;
      backdropImage = showDetails.backdrop_path;

      // 1. Create collection record
      await db.insert(collections).values({
        id: collectionId,
        userId: session.user.id,
        title: title || showDetails.name,
        description: description || showDetails.overview,
        collectionType: "tv_show",
        tmdbId: Number(tmdbId),
        defaultRatingSystemId: defaultRatingSystemId || null,
        customCoverImage,
        backdropImage,
      });

      // 2. Fetch and import episodes for selected seasons (or all seasons excluding season 0 / specials if desired, or all)
      const seasonsToFetch = showDetails.seasons.filter((s) => {
        if (s.season_number === 0) return false; // usually specials
        if (
          Array.isArray(selectedSeasonNumbers) &&
          selectedSeasonNumbers.length > 0
        ) {
          return selectedSeasonNumbers.includes(s.season_number);
        }
        return true;
      });

      let sortIdx = 0;
      for (const seasonMeta of seasonsToFetch) {
        try {
          const seasonData = await tmdb.getTvSeason(
            Number(tmdbId),
            seasonMeta.season_number
          );
          if (seasonData.episodes) {
            for (const ep of seasonData.episodes) {
              const mediaId = `tv_${tmdbId}_s${ep.season_number}_e${ep.episode_number}`;

              // Upsert mediaItem
              await db
                .insert(mediaItems)
                .values({
                  id: mediaId,
                  tmdbId: ep.id,
                  mediaType: "episode",
                  title: ep.name,
                  overview: ep.overview,
                  stillPath: ep.still_path,
                  posterPath: seasonMeta.poster_path || showDetails.poster_path,
                  backdropPath: showDetails.backdrop_path,
                  releaseDate: ep.air_date,
                  seasonNumber: ep.season_number,
                  episodeNumber: ep.episode_number,
                  tmdbMetadata: {
                    showName: showDetails.name,
                    showId: showDetails.id,
                    voteAverage: ep.vote_average,
                  },
                })
                .onConflictDoNothing();

              // Add collection entry
              sortIdx++;
              await db.insert(collectionEntries).values({
                id: `entry_${Date.now()}_${nanoid(6)}`,
                collectionId,
                mediaItemId: mediaId,
                sortOrder: sortIdx,
              });
            }
          }
        } catch (seasonErr) {
          console.error(`Failed to fetch season ${seasonMeta.season_number}:`, seasonErr);
        }
      }

      return NextResponse.json({ id: collectionId, success: true });
    }

    // B. MOVIE FRANCHISE IMPORT
    if (collectionType === "movie_franchise" && tmdbId) {
      const collectionDetails = await tmdb.getMovieCollection(Number(tmdbId));
      customCoverImage = collectionDetails.poster_path;
      backdropImage = collectionDetails.backdrop_path;

      await db.insert(collections).values({
        id: collectionId,
        userId: session.user.id,
        title: title || collectionDetails.name,
        description: description || collectionDetails.overview,
        collectionType: "movie_franchise",
        tmdbId: Number(tmdbId),
        defaultRatingSystemId: defaultRatingSystemId || null,
        customCoverImage,
        backdropImage,
      });

      let sortIdx = 0;
      // Sort parts by release date
      const parts = (collectionDetails.parts || []).sort((a, b) =>
        (a.release_date || "").localeCompare(b.release_date || "")
      );

      for (const movie of parts) {
        const mediaId = `movie_${movie.id}`;
        await db
          .insert(mediaItems)
          .values({
            id: mediaId,
            tmdbId: movie.id,
            mediaType: "movie",
            title: movie.title,
            overview: movie.overview,
            posterPath: movie.poster_path,
            backdropPath: movie.backdrop_path || collectionDetails.backdrop_path,
            releaseDate: movie.release_date,
            tmdbMetadata: {
              collectionId: collectionDetails.id,
              collectionName: collectionDetails.name,
              voteAverage: movie.vote_average,
            },
          })
          .onConflictDoNothing();

        sortIdx++;
        await db.insert(collectionEntries).values({
          id: `entry_${Date.now()}_${nanoid(6)}`,
          collectionId,
          mediaItemId: mediaId,
          sortOrder: sortIdx,
        });
      }

      return NextResponse.json({ id: collectionId, success: true });
    }

    // C. CUSTOM COLLECTION
    await db.insert(collections).values({
      id: collectionId,
      userId: session.user.id,
      title,
      description: description || null,
      collectionType: "custom",
      defaultRatingSystemId: defaultRatingSystemId || null,
    });

    return NextResponse.json({ id: collectionId, success: true });
  } catch (error: any) {
    console.error("[Create Collection Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create collection" },
      { status: 500 }
    );
  }
}
