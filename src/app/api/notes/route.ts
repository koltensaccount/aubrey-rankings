import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { mediaNotes } from "@/db/schema";
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

  // Empty content is an intentional tombstone, preventing legacy text resurrection.
  await db.insert(mediaNotes).values({
    id: `note_${randomUUID()}`, userId: session.user.id, mediaItemId: resolvedMediaId,
    content: trimmedContent, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: [mediaNotes.userId, mediaNotes.mediaItemId],
    set: { content: trimmedContent, updatedAt: now },
  });

  return NextResponse.json({
    success: true,
    notes: trimmedContent,
    updatedAt: now,
  });
}
