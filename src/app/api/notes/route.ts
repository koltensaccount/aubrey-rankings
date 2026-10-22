import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { mediaNotes, ratings, mediaItems } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { resolveMediaItem } from "@/lib/media-resolution";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mediaItemId = request.nextUrl.searchParams.get("mediaItemId");
  if (!mediaItemId) {
    return NextResponse.json({ error: "mediaItemId is required" }, { status: 400 });
  }

  const resolvedMediaId = await resolveMediaItem(mediaItemId);
  if (!resolvedMediaId) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  // 1. Check authoritative universal mediaNotes table
  const existingNote = await db.query.mediaNotes.findFirst({
    where: (mn, { and, eq }) =>
      and(eq(mn.userId, session.user.id), eq(mn.mediaItemId, resolvedMediaId)),
  });

  if (existingNote) {
    return NextResponse.json({
      notes: existingNote.content,
      updatedAt: existingNote.updatedAt,
      isLegacy: false,
    });
  }

  // 2. Safe lazy adoption: check legacy personalNotes in ratings
  const legacyRating = await db.query.ratings.findFirst({
    where: (r, { and, eq, isNull }) =>
      and(
        eq(r.userId, session.user.id),
        eq(r.mediaItemId, resolvedMediaId),
        isNull(r.collectionId)
      ),
    columns: { personalNotes: true, updatedAt: true },
  });

  if (legacyRating?.personalNotes && legacyRating.personalNotes.trim()) {
    const legacyContent = legacyRating.personalNotes.trim();
    // Non-destructive adoption into universal mediaNotes
    await db
      .insert(mediaNotes)
      .values({
        id: `note_${randomUUID()}`,
        userId: session.user.id,
        mediaItemId: resolvedMediaId,
        content: legacyContent,
        updatedAt: legacyRating.updatedAt || new Date(),
      })
      .onConflictDoNothing();

    return NextResponse.json({
      notes: legacyContent,
      updatedAt: legacyRating.updatedAt || new Date(),
      isLegacy: true,
    });
  }

  return NextResponse.json({
    notes: "",
    updatedAt: null,
    isLegacy: false,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { mediaItemId, content } = body;

  if (!mediaItemId || typeof mediaItemId !== "string") {
    return NextResponse.json({ error: "mediaItemId is required" }, { status: 400 });
  }

  if (typeof content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }

  const resolvedMediaId = await resolveMediaItem(mediaItemId);
  if (!resolvedMediaId) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  const trimmedContent = content.trim();
  const now = new Date();

  // 1. Authoritative upsert into mediaNotes
  const existingNote = await db.query.mediaNotes.findFirst({
    where: (mn, { and, eq }) =>
      and(eq(mn.userId, session.user.id), eq(mn.mediaItemId, resolvedMediaId)),
  });

  if (existingNote) {
    await db
      .update(mediaNotes)
      .set({
        content: trimmedContent,
        updatedAt: now,
      })
      .where(eq(mediaNotes.id, existingNote.id));
  } else {
    await db.insert(mediaNotes).values({
      id: `note_${randomUUID()}`,
      userId: session.user.id,
      mediaItemId: resolvedMediaId,
      content: trimmedContent,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Backward compatibility: sync to ratings.personalNotes if global rating exists
  await db
    .update(ratings)
    .set({
      personalNotes: trimmedContent || null,
      updatedAt: now,
    })
    .where(
      and(
        eq(ratings.userId, session.user.id),
        eq(ratings.mediaItemId, resolvedMediaId),
        isNull(ratings.collectionId)
      )
    );

  return NextResponse.json({
    success: true,
    notes: trimmedContent,
    updatedAt: now,
  });
}
