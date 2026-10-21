import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { watchlistItems, mediaItems } from "@/db/schema";
import { resolveMediaItem } from "@/lib/media-resolution";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const items = await db.query.watchlistItems.findMany({
      where: eq(watchlistItems.userId, session.user.id),
      orderBy: [desc(watchlistItems.createdAt)],
      limit,
      offset,
      with: {
        mediaItem: true,
      },
    });

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("[Watchlist GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve watchlist" },
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body.mediaItemId !== "string") {
      return NextResponse.json(
        { error: "A valid mediaItemId is required" },
        { status: 400 },
      );
    }

    const resolvedId = await resolveMediaItem(body.mediaItemId);
    if (!resolvedId) {
      return NextResponse.json(
        { error: "Media item could not be resolved" },
        { status: 404 },
      );
    }

    const existing = await db.query.watchlistItems.findFirst({
      where: and(
        eq(watchlistItems.userId, session.user.id),
        eq(watchlistItems.mediaItemId, resolvedId),
      ),
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        item: existing,
        message: "Already on watchlist",
      });
    }

    const [inserted] = await db
      .insert(watchlistItems)
      .values({
        id: `wl_${randomUUID()}`,
        userId: session.user.id,
        mediaItemId: resolvedId,
        notes: typeof body.notes === "string" ? body.notes.trim() : null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      item: inserted,
      message: "Added to watchlist",
    });
  } catch (error: any) {
    console.error("[Watchlist POST Error]", error);
    return NextResponse.json(
      { error: "Failed to add item to watchlist" },
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
    const mediaItemId = searchParams.get("mediaItemId");
    if (!mediaItemId) {
      return NextResponse.json(
        { error: "mediaItemId parameter is required" },
        { status: 400 },
      );
    }

    const resolvedId = (await resolveMediaItem(mediaItemId)) || mediaItemId;

    await db
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, session.user.id),
          eq(watchlistItems.mediaItemId, resolvedId),
        ),
      );

    return NextResponse.json({
      success: true,
      message: "Removed from watchlist",
    });
  } catch (error: any) {
    console.error("[Watchlist DELETE Error]", error);
    return NextResponse.json(
      { error: "Failed to remove item from watchlist" },
      { status: 500 },
    );
  }
}
