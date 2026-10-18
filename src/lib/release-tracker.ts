import { db } from "@/db";
import {
  releaseTrackingSubscriptions,
  processedReleaseEvents,
  collections,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { tmdb } from "@/lib/tmdb";
import { createNotification } from "@/lib/notifications";
import { randomUUID } from "crypto";

export interface TrackingStatus {
  supported: boolean;
  enabled: boolean;
  tmdbType: "tv" | "movie_collection" | null;
  tmdbId: number | null;
  targetTitle: string | null;
  explanation: string;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Check if a collection supports release tracking, and get current subscription status.
 */
export async function getCollectionTrackingStatus(
  collectionId: string,
  userId?: string | null
): Promise<TrackingStatus> {
  const col = await db.query.collections.findFirst({
    where: (c, { eq }) => eq(c.id, collectionId),
    columns: { id: true, title: true, collectionType: true, tmdbId: true, userId: true, visibility: true },
  });

  if (!col || (col.userId !== userId && col.visibility !== "public" && col.visibility !== "unlisted")) {
    return {
      supported: false,
      enabled: false,
      tmdbType: null,
      tmdbId: null,
      targetTitle: null,
      explanation: "Collection not found.",
    };
  }

  const effectiveUserId = userId;

  if (col.collectionType === "tv_show" && col.tmdbId) {
    let enabled = true;
    if (effectiveUserId) {
      const sub = await db.query.releaseTrackingSubscriptions.findFirst({
        where: (s, { and, eq }) =>
          and(eq(s.userId, effectiveUserId), eq(s.collectionId, collectionId)),
      });
      if (sub) {
        enabled = sub.enabled;
      }
    }
    return {
      supported: true,
      enabled,
      tmdbType: "tv",
      tmdbId: col.tmdbId,
      targetTitle: col.title,
      explanation: `Tracking new episodes of ${col.title} as they air on TMDB.`,
    };
  }

  if (col.collectionType === "movie_franchise" && col.tmdbId) {
    let enabled = true;
    if (effectiveUserId) {
      const sub = await db.query.releaseTrackingSubscriptions.findFirst({
        where: (s, { and, eq }) =>
          and(eq(s.userId, effectiveUserId), eq(s.collectionId, collectionId)),
      });
      if (sub) {
        enabled = sub.enabled;
      }
    }
    return {
      supported: true,
      enabled,
      tmdbType: "movie_collection",
      tmdbId: col.tmdbId,
      targetTitle: col.title,
      explanation: `Tracking new franchise installments released in ${col.title}.`,
    };
  }

  return {
    supported: false,
    enabled: false,
    tmdbType: null,
    tmdbId: null,
    targetTitle: col.title,
    explanation:
      "Automatic release tracking is available for rankings linked to TMDB television series or official movie franchises.",
  };
}

/**
 * Enable or disable release tracking for a collection and baseline existing releases.
 */
export async function setCollectionTracking(
  collectionId: string,
  userId: string,
  enabled: boolean
): Promise<TrackingStatus> {
  const status = await getCollectionTrackingStatus(collectionId, userId);
  if (!status.supported || !status.tmdbType || !status.tmdbId) {
    throw new Error(status.explanation);
  }

  const today = getTodayIsoDate();

  const existing = await db.query.releaseTrackingSubscriptions.findFirst({
    where: (s, { and, eq }) =>
      and(eq(s.userId, userId), eq(s.collectionId, collectionId)),
  });

  if (existing) {
    await db
      .update(releaseTrackingSubscriptions)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(releaseTrackingSubscriptions.id, existing.id));
  } else {
    // Creating fresh subscription: establish baseline so previous episodes aren't notified
    const subId = randomUUID();
    await db.insert(releaseTrackingSubscriptions).values({
      id: subId,
      userId,
      collectionId,
      tmdbType: status.tmdbType,
      tmdbId: status.tmdbId,
      enabled,
      baselineDate: today,
      lastCheckedAt: new Date(),
    });

    // Populate baseline release events for this show/collection so historical episodes are ignored
    await initializeReleaseBaseline(status.tmdbType, status.tmdbId, today);
  }

  return {
    ...status,
    enabled,
  };
}

/**
 * Baseline historical releases up to `cutoffDate` to prevent historical notification spam.
 */
export async function initializeReleaseBaseline(
  tmdbType: "tv" | "movie_collection",
  tmdbId: number,
  cutoffDate: string
) {
  try {
    if (tmdbType === "tv") {
      const details = await tmdb.getTvDetails(tmdbId);
      if (!details?.seasons) return;

      for (const s of details.seasons) {
        if (!s.season_number || s.season_number < 1) continue;
        try {
          const season = await tmdb.getTvSeason(tmdbId, s.season_number);
          if (season?.episodes) {
            for (const ep of season.episodes) {
              if (ep.air_date && ep.air_date <= cutoffDate) {
                const eventKey = `tv:${tmdbId}:s${ep.season_number}e${ep.episode_number}`;
                await db
                  .insert(processedReleaseEvents)
                  .values({
                    id: randomUUID(),
                    eventKey,
                    tmdbType: "tv",
                    tmdbId,
                    releaseDate: ep.air_date,
                    metadata: { title: ep.name, showName: details.name },
                  })
                  .onConflictDoNothing();
              }
            }
          }
        } catch {
          // Continue if individual season fails
        }
      }
    } else if (tmdbType === "movie_collection") {
      const details = await tmdb.getMovieCollection(tmdbId);
      if (details?.parts) {
        for (const part of details.parts) {
          if (part.release_date && part.release_date <= cutoffDate) {
            const eventKey = `movie:${tmdbId}:m${part.id}`;
            await db
              .insert(processedReleaseEvents)
              .values({
                id: randomUUID(),
                eventKey,
                tmdbType: "movie_collection",
                tmdbId,
                releaseDate: part.release_date,
                metadata: { title: part.title, collectionName: details.name },
              })
              .onConflictDoNothing();
          }
        }
      }
    }
  } catch (err) {
    console.error("Baseline initialization failed for TMDB ID:", tmdbId, err);
  }
}

/**
 * Scheduled or on-demand runner that checks TMDB for new episodes and franchise releases.
 * Fully idempotent, rate-limit friendly, and isolated per title.
 */
export async function checkNewReleases() {
  const today = getTodayIsoDate();
  const errors: string[] = [];

  // 1. Query all active subscriptions
  const activeSubs = await db.query.releaseTrackingSubscriptions.findMany({
    where: (s, { eq }) => eq(s.enabled, true),
    with: {
      collection: {
        columns: { id: true, title: true, isPublic: true, visibility: true, userId: true },
      },
    },
  });

  if (activeSubs.length === 0) {
    return {
      success: true,
      processedShows: 0,
      processedFranchises: 0,
      notificationsCreated: 0,
    };
  }

  // 2. Group subscriptions by TMDB title to avoid redundant TMDB requests
  const tvGroups = new Map<number, typeof activeSubs>();
  const movieGroups = new Map<number, typeof activeSubs>();

  for (const sub of activeSubs) {
    if (!sub.collection || (sub.collection.userId !== sub.userId && sub.collection.visibility === "private")) continue;
    if (sub.tmdbType === "tv") {
      const list = tvGroups.get(sub.tmdbId) || [];
      list.push(sub);
      tvGroups.set(sub.tmdbId, list);
    } else if (sub.tmdbType === "movie_collection") {
      const list = movieGroups.get(sub.tmdbId) || [];
      list.push(sub);
      movieGroups.set(sub.tmdbId, list);
    }
  }

  let notificationsCreated = 0;

  // 3. Process TV Shows
  for (const [tmdbId, subs] of tvGroups.entries()) {
    try {
      const details = await tmdb.getTvDetails(tmdbId);
      if (!details || !details.seasons) continue;

      // Find lowest baseline date among subscribers of this show
      const minBaseline = subs.reduce(
        (min, s) => (!min || (s.baselineDate && s.baselineDate < min) ? s.baselineDate : min),
        null as string | null
      ) || "2000-01-01";

      for (const seasonMeta of details.seasons) {
        if (!seasonMeta.season_number || seasonMeta.season_number < 1) continue;

        // Only inspect seasons that might have aired since baseline
        if (seasonMeta.air_date && seasonMeta.air_date < minBaseline) {
          // Season aired before any subscriber's baseline, check if it's the latest season
          if (seasonMeta.season_number < details.number_of_seasons) {
            continue;
          }
        }

        try {
          const season = await tmdb.getTvSeason(tmdbId, seasonMeta.season_number);
          if (!season?.episodes) continue;

          for (const ep of season.episodes) {
            // Must have aired on or before today
            if (!ep.air_date || ep.air_date > today) continue;

            const eventKey = `tv:${tmdbId}:s${ep.season_number}e${ep.episode_number}`;

            // Check if this event was already processed
            const alreadyProcessed = await db.query.processedReleaseEvents.findFirst({
              where: (e, { eq }) => eq(e.eventKey, eventKey),
            });

            // Shared event history cannot suppress per-user delivery; recipient deduplication is authoritative.

            // Record release event
            await db
              .insert(processedReleaseEvents)
              .values({
                id: randomUUID(),
                eventKey,
                tmdbType: "tv",
                tmdbId,
                releaseDate: ep.air_date,
                metadata: {
                  showName: details.name,
                  seasonNumber: ep.season_number,
                  episodeNumber: ep.episode_number,
                  episodeTitle: ep.name,
                },
              })
              .onConflictDoNothing();

            // Notify subscribers whose baseline is strictly BEFORE this episode's air date
            for (const sub of subs) {
              if (sub.baselineDate && ep.air_date <= sub.baselineDate) {
                continue; // Episode aired before user began tracking
              }

              const notif = await createNotification({
                recipientUserId: sub.userId,
                notificationType: "tv_release",
                returnExisting: false,
                collectionId: sub.collectionId,
                deduplicationKey: `tv_release:${sub.userId}:${tmdbId}:s${ep.season_number}e${ep.episode_number}`,
                metadata: {
                  showName: details.name,
                  collectionTitle: sub.collection?.title || details.name,
                  seasonNumber: ep.season_number,
                  episodeNumber: ep.episode_number,
                  episodeTitle: ep.name,
                  stillPath: ep.still_path || details.backdrop_path,
                  releaseDate: ep.air_date,
                  message: `New episode of ${details.name} aired: S${ep.season_number}E${ep.episode_number} "${ep.name}".`,
                  targetUrl: `/collection/${sub.collectionId}`,
                },
              });

              if (notif) notificationsCreated++;
            }
          }
        } catch (seasonErr) {
          errors.push(`TV ${tmdbId} season ${seasonMeta.season_number}`);
          console.error(`Failed to process TV season ${seasonMeta.season_number} for show ${tmdbId}:`, seasonErr);
        }
      }

      // Mark subscriptions checked
      await db
        .update(releaseTrackingSubscriptions)
        .set({ lastCheckedAt: new Date() })
        .where(
          and(
            eq(releaseTrackingSubscriptions.tmdbType, "tv"),
            eq(releaseTrackingSubscriptions.tmdbId, tmdbId)
          )
        );
    } catch (showErr) {
      errors.push(`TV ${tmdbId}`);
      console.error(`Failed to check TV show ${tmdbId}:`, showErr);
    }
  }

  // 4. Process Movie Franchises
  for (const [tmdbId, subs] of movieGroups.entries()) {
    try {
      const details = await tmdb.getMovieCollection(tmdbId);
      if (!details || !details.parts) continue;

      for (const part of details.parts) {
        if (!part.release_date || part.release_date > today) continue;

        const eventKey = `movie:${tmdbId}:m${part.id}`;

        const alreadyProcessed = await db.query.processedReleaseEvents.findFirst({
          where: (e, { eq }) => eq(e.eventKey, eventKey),
        });

        // Shared event history cannot suppress per-user delivery; recipient deduplication is authoritative.

        // Record release event
        await db
          .insert(processedReleaseEvents)
          .values({
            id: randomUUID(),
            eventKey,
            tmdbType: "movie_collection",
            tmdbId,
            releaseDate: part.release_date,
            metadata: {
              franchiseName: details.name,
              movieTitle: part.title,
              movieId: part.id,
            },
          })
          .onConflictDoNothing();

        // Notify subscribers whose baseline is strictly BEFORE this movie's release date
        for (const sub of subs) {
          if (sub.baselineDate && part.release_date <= sub.baselineDate) {
            continue;
          }

          const notif = await createNotification({
            recipientUserId: sub.userId,
            notificationType: "movie_release",
            returnExisting: false,
            collectionId: sub.collectionId,
            deduplicationKey: `movie_release:${sub.userId}:${tmdbId}:m${part.id}`,
            metadata: {
              franchiseName: details.name,
              collectionTitle: sub.collection?.title || details.name,
              movieTitle: part.title,
              movieId: part.id,
              posterPath: part.poster_path,
              releaseDate: part.release_date,
              message: `A new movie in ${details.name} has been released: "${part.title}".`,
              targetUrl: `/collection/${sub.collectionId}`,
            },
          });

          if (notif) notificationsCreated++;
        }
      }

      await db
        .update(releaseTrackingSubscriptions)
        .set({ lastCheckedAt: new Date() })
        .where(
          and(
            eq(releaseTrackingSubscriptions.tmdbType, "movie_collection"),
            eq(releaseTrackingSubscriptions.tmdbId, tmdbId)
          )
        );
    } catch (franchiseErr) {
      errors.push(`Movie collection ${tmdbId}`);
      console.error(`Failed to check Movie Franchise ${tmdbId}:`, franchiseErr);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    processedShows: tvGroups.size,
    processedFranchises: movieGroups.size,
    notificationsCreated,
  };
}
