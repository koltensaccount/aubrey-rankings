import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { collections, collectionEntries, mediaItems } from "@/db/schema";
import { tmdb } from "@/lib/tmdb";
import { nanoid } from "@/lib/utils";
import { eq, and, desc } from "drizzle-orm";
import { resolveMediaItem } from "@/lib/media-resolution";
import { markRankedMediaAsWatched } from "@/lib/watched-status";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const col = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, collectionId), eq(c.userId, session.user.id)),
    });

    if (!col) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { mediaItemId, tmdbId, mediaType, seasonNumber, episodeNumber, customTitle, overview, posterPath, stillPath } = body;

    if (
      (mediaItemId !== undefined && (typeof mediaItemId !== "string" || !mediaItemId.trim())) ||
      (tmdbId !== undefined && (!Number.isInteger(tmdbId) || tmdbId <= 0)) ||
      [seasonNumber, episodeNumber].some((v) => v !== undefined && (!Number.isInteger(v) || v < 0)) ||
      (customTitle !== undefined && (typeof customTitle !== "string" || customTitle.length > 300))
    ) {
      return NextResponse.json({ error: "Invalid entry fields" }, { status: 400 });
    }

    let targetMediaItemId: string | null = null;

    if (mediaItemId && typeof mediaItemId === "string") {
      targetMediaItemId = await resolveMediaItem(mediaItemId);
    } else if (tmdbId && mediaType === "episode" && seasonNumber !== undefined && episodeNumber !== undefined) {
      targetMediaItemId = await resolveMediaItem(`tv_${tmdbId}_s${seasonNumber}_e${episodeNumber}`);
    } else if (tmdbId && (mediaType === "movie" || !mediaType)) {
      targetMediaItemId = await resolveMediaItem(`movie_${tmdbId}`);
    } else if (customTitle && typeof customTitle === "string" && customTitle.trim()) {
      targetMediaItemId = `custom_${Date.now()}_${nanoid(6)}`;
      await db.insert(mediaItems).values({
        id: targetMediaItemId,
        mediaType: "custom",
        title: customTitle.trim(),
        overview: overview || null,
        posterPath: posterPath || null,
        stillPath: stillPath || null,
      });
    } else {
      return NextResponse.json(
        { error: "Must provide either mediaItemId, tmdbId for movie/episode, or customTitle" },
        { status: 400 }
      );
    }

    if (!targetMediaItemId) {
      return NextResponse.json({ error: "Media item could not be resolved" }, { status: 404 });
    }

    // Resolve media item to enforce collection type compatibility
    const targetItem = await db.query.mediaItems.findFirst({
      where: (m, { eq }) => eq(m.id, targetMediaItemId!),
    });

    if (!targetItem) {
      return NextResponse.json({ error: "Media item could not be resolved" }, { status: 404 });
    }

    // Validate collection type compatibility
    if (col.collectionType === "movie_franchise") {
      if (targetItem.mediaType !== "movie") {
        return NextResponse.json(
          { error: "Movie franchise rankings only accept films." },
          { status: 400 }
        );
      }
    } else if (col.collectionType === "tv_show") {
      if (targetItem.mediaType !== "episode") {
        return NextResponse.json(
          { error: "TV series rankings only accept episodes." },
          { status: 400 }
        );
      }
      if (col.tmdbId) {
        const showPrefix = `tv_${col.tmdbId}_`;
        const belongs =
          targetItem.id.startsWith(showPrefix) ||
          targetItem.id.startsWith(`tmdb-tv-${col.tmdbId}`) ||
          (targetItem.parentMediaId != null &&
            (targetItem.parentMediaId === `tv_${col.tmdbId}` ||
              targetItem.parentMediaId.startsWith(showPrefix) ||
              targetItem.parentMediaId === `tmdb-tv-${col.tmdbId}`));
        if (!belongs) {
          return NextResponse.json(
            { error: "This episode does not belong to the television series for this ranking." },
            { status: 400 }
          );
        }
      }
    }

    // Check duplicate in collection
    const existingEntry = await db.query.collectionEntries.findFirst({
      where: (ce, { eq, and }) =>
        and(
          eq(ce.collectionId, collectionId),
          eq(ce.mediaItemId, targetMediaItemId!)
        ),
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: "This item is already included in this ranking collection." },
        { status: 409 }
      );
    }

    // Determine next sort order
    const lastEntry = await db.query.collectionEntries.findFirst({
      where: (ce, { eq }) => eq(ce.collectionId, collectionId),
      orderBy: [desc(collectionEntries.sortOrder)],
    });

    const nextOrder = (lastEntry?.sortOrder || 0) + 1;
    const entryId = `entry_${Date.now()}_${nanoid(6)}`;

    const inserted = await db.insert(collectionEntries).values({
      id: entryId,
      collectionId,
      mediaItemId: targetMediaItemId!,
      sortOrder: nextOrder,
    }).onConflictDoNothing().returning({id:collectionEntries.id});
    if (!inserted.length) return NextResponse.json({error:"This item is already in this collection"},{status:409});

    // Ranking an item implies Watched status idempotently in global library
    await markRankedMediaAsWatched(session.user.id, targetMediaItemId!);

    // Fetch created entry with mediaItem
    const created = await db.query.collectionEntries.findFirst({
      where: (ce, { eq }) => eq(ce.id, entryId),
      with: {
        mediaItem: true,
      },
    });

    return NextResponse.json({ success: true, entry: created });
  } catch (error: any) {
    console.error("[Add Collection Entry Error]", error);
    return NextResponse.json(
      { error: "Failed to add entry to collection" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const col = await db.query.collections.findFirst({
      where: (c, { eq, and }) =>
        and(eq(c.id, collectionId), eq(c.userId, session.user.id)),
    });

    if (!col) {
      return NextResponse.json(
        { error: "Collection not found or access denied" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: "Expected an entries array" },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      for (const item of body.entries) {
        if (typeof item.id === "string" && Number.isInteger(item.sortOrder)) {
          await tx
            .update(collectionEntries)
            .set({ sortOrder: item.sortOrder })
            .where(
              and(
                eq(collectionEntries.id, item.id),
                eq(collectionEntries.collectionId, collectionId)
              )
            );
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Reorder Collection Entries Error]", error);
    return NextResponse.json(
      { error: "Failed to update entry sort order" },
      { status: 500 }
    );
  }
}

