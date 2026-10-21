import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { db } from "@/db";
import { importSourceMappings, unresolvedImportItems, mediaItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveMediaItem } from "@/lib/media-resolution";
import { randomUUID } from "crypto";
import { TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const cookieStore = await cookies();
  const adminReturnToken = cookieStore.get("aubrey_admin_session_token")?.value;

  const isDirectAdmin = session && checkIsAdmin(session);
  const isInTestWorkspaceWithReturn =
    session?.user.id === TEST_WORKSPACE_USER_ID && Boolean(adminReturnToken);

  if (!isDirectAdmin && !isInTestWorkspaceWithReturn) {
    return NextResponse.json(
      { error: "Unauthorized. Admin privileges required." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { unresolvedItemId, tmdbId, mediaType = "movie" } = body;

  if (!unresolvedItemId || !tmdbId) {
    return NextResponse.json(
      { error: "unresolvedItemId and tmdbId are required." },
      { status: 400 }
    );
  }

  const unresolved = await db.query.unresolvedImportItems.findFirst({
    where: eq(unresolvedImportItems.id, unresolvedItemId),
  });

  if (!unresolved) {
    return NextResponse.json({ error: "Quarantined item not found" }, { status: 404 });
  }

  try {
    // 1. Resolve media item in Aubrey database
    const identifier = mediaType === "tv" ? `tmdb-tv-${tmdbId}` : `tmdb-movie-${tmdbId}`;
    const resolvedMediaId = await resolveMediaItem(identifier);

    if (!resolvedMediaId) {
      return NextResponse.json({ error: "Failed to resolve media item from TMDB" }, { status: 500 });
    }

    const resolvedRecord = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, resolvedMediaId),
    });

    const sourceData = unresolved.sourceData as any;
    const sourceTitle = sourceData?.title || sourceData?.name || unresolved.details || "Unknown";
    const sourceYear = sourceData?.year || null;
    const sourceUri = sourceData?.uri || sourceData?.letterboxdUri || null;

    // 2. Persist confirmed mapping in import_source_mappings
    await db
      .insert(importSourceMappings)
      .values({
        id: `map_${randomUUID()}`,
        sourceService: "letterboxd",
        sourceUri,
        sourceTitle,
        sourceYear,
        sourceMediaType: mediaType,
        mediaItemId: resolvedMediaId,
        confidence: "manual_verified",
        metadata: {
          manualAdminResolution: true,
          tmdbId,
          resolvedAt: new Date().toISOString(),
          mediaTitle: resolvedRecord?.title,
          posterPath: resolvedRecord?.posterPath,
        },
      })
      .onConflictDoNothing();

    // 3. Remove quarantined entry
    await db.delete(unresolvedImportItems).where(eq(unresolvedImportItems.id, unresolvedItemId));

    return NextResponse.json({
      success: true,
      message: `Successfully resolved "${sourceTitle}" to "${resolvedRecord?.title}".`,
      mediaItem: resolvedRecord,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to resolve mapping" },
      { status: 500 }
    );
  }
}
