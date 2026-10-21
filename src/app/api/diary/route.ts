import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { diaryEntries, ratings, mediaItems } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mediaItemId = searchParams.get("mediaItemId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const conditions = [eq(diaryEntries.userId, session.user.id)];
    if (mediaItemId) {
      conditions.push(eq(diaryEntries.mediaItemId, mediaItemId));
    }

    const entries = await db.query.diaryEntries.findMany({
      where: and(...conditions),
      orderBy: [desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt)],
      limit,
      offset,
      with: {
        mediaItem: true,
        rating: true,
        review: true,
      },
    });

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error: any) {
    console.error("[Diary GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve diary entries" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mediaItemId, watchedDate, isRewatch, ratingValue, notes, tags } = body;

    if (!mediaItemId) {
      return NextResponse.json(
        { error: "mediaItemId is required" },
        { status: 400 },
      );
    }

    // Verify media item exists
    const media = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, mediaItemId),
    });
    if (!media) {
      return NextResponse.json(
        { error: "Media item not found" },
        { status: 404 },
      );
    }

    // Check if this is automatically a rewatch if not specified
    let finalIsRewatch = Boolean(isRewatch);
    if (isRewatch === undefined) {
      const existingEntries = await db.query.diaryEntries.findFirst({
        where: and(
          eq(diaryEntries.userId, session.user.id),
          eq(diaryEntries.mediaItemId, mediaItemId),
        ),
      });
      if (existingEntries) {
        finalIsRewatch = true;
      }
    }

    const entryId = randomUUID();
    const formattedWatchedDate =
      typeof watchedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(watchedDate.trim())
        ? watchedDate.trim()
        : new Date().toISOString().slice(0, 10);

    const parsedRating =
      typeof ratingValue === "number" && !isNaN(ratingValue)
        ? Math.max(0, Math.min(10, ratingValue))
        : null;

    // Create diary entry
    await db.insert(diaryEntries).values({
      id: entryId,
      userId: session.user.id,
      mediaItemId,
      watchedDate: formattedWatchedDate,
      loggedDate: new Date(),
      isRewatch: finalIsRewatch,
      ratingValue: parsedRating,
      notes: typeof notes === "string" ? notes.trim() : null,
      tags: Array.isArray(tags) ? tags : null,
    });

    // Mark media item as watched globally for the user
    const existingRating = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.userId, session.user.id),
        eq(ratings.mediaItemId, mediaItemId),
        isNull(ratings.collectionId),
      ),
    });

    if (existingRating) {
      if (!existingRating.isWatched) {
        await db
          .update(ratings)
          .set({ isWatched: true, updatedAt: new Date() })
          .where(eq(ratings.id, existingRating.id));
      }
    } else {
      await db.insert(ratings).values({
        id: randomUUID(),
        userId: session.user.id,
        mediaItemId,
        isWatched: true,
        sourceRating: parsedRating,
        sourceScale: parsedRating !== null ? 10 : null,
      });
    }

    const created = await db.query.diaryEntries.findFirst({
      where: eq(diaryEntries.id, entryId),
      with: {
        mediaItem: true,
        rating: true,
        review: true,
      },
    });

    return NextResponse.json({
      success: true,
      entry: created,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[Diary POST Error]", error);
    return NextResponse.json(
      { error: "Failed to create diary entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.query.diaryEntries.findFirst({
      where: and(
        eq(diaryEntries.id, id),
        eq(diaryEntries.userId, session.user.id),
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await db.delete(diaryEntries).where(eq(diaryEntries.id, id));

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("[Diary DELETE Error]", error);
    return NextResponse.json(
      { error: "Failed to delete diary entry" },
      { status: 500 },
    );
  }
}
