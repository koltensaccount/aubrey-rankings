import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importSourceMappings, unresolvedImportItems, mediaItems } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveMediaItem } from "@/lib/media-resolution";
import { randomUUID } from "crypto";
import { verifyAdminOrTestSession, TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
import { clearResolutionCache } from "@/lib/letterboxd-matching";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { unresolvedItemId, tmdbId, mediaType = "movie", seasonNumber, episodeNumber } = body;

  if (!unresolvedItemId || !tmdbId) {
    return NextResponse.json(
      { error: "unresolvedItemId and tmdbId are required." },
      { status: 400 }
    );
  }

  // Scope quarantined item lookup strictly to the test workspace
  const unresolved = await db.query.unresolvedImportItems.findFirst({
    where: and(
      eq(unresolvedImportItems.id, unresolvedItemId),
      eq(unresolvedImportItems.userId, TEST_WORKSPACE_USER_ID)
    ),
  });

  if (!unresolved) {
    return NextResponse.json({ error: "Quarantined item not found in test workspace" }, { status: 404 });
  }

  try {
    const isEpisode =
      mediaType === "episode" ||
      (seasonNumber !== undefined && episodeNumber !== undefined && seasonNumber !== null && episodeNumber !== null);

    // 1. Resolve media item in Aubrey database
    let identifier: string;
    let resolvedMediaType: string = mediaType;

    if (isEpisode) {
      identifier = `tv_${tmdbId}_s${seasonNumber}_e${episodeNumber}`;
      resolvedMediaType = "episode";
    } else if (mediaType === "tv") {
      identifier = `tmdb-tv-${tmdbId}`;
      resolvedMediaType = "tv";
    } else {
      identifier = `tmdb-movie-${tmdbId}`;
      resolvedMediaType = "movie";
    }

    const resolvedMediaId = await resolveMediaItem(identifier);

    if (!resolvedMediaId) {
      return NextResponse.json(
        { error: "Failed to resolve media item from TMDB" },
        { status: 500 }
      );
    }

    const resolvedRecord = await db.query.mediaItems.findFirst({
      where: eq(mediaItems.id, resolvedMediaId),
    });

    const sourceData = unresolved.sourceData as any;
    const sourceTitle = sourceData?.title || sourceData?.name || unresolved.details || "Unknown";
    const sourceYear = sourceData?.year || null;
    const sourceUri = sourceData?.uri || sourceData?.letterboxdUri || null;

    const metadataObj: Record<string, any> = {
      manualAdminResolution: true,
      isTestWorkspace: true,
      tmdbId,
      resolvedAt: new Date().toISOString(),
      mediaTitle: resolvedRecord?.title,
      posterPath: resolvedRecord?.posterPath,
      stillPath: resolvedRecord?.stillPath,
    };
    if (isEpisode) {
      metadataObj.seriesTmdbId = tmdbId;
      metadataObj.seasonNumber = seasonNumber;
      metadataObj.episodeNumber = episodeNumber;
    }

    // 2. Persist confirmed mapping in import_source_mappings with onConflictDoUpdate
    let existingMapping = null;
    if (sourceUri) {
      existingMapping = await db.query.importSourceMappings.findFirst({
        where: and(
          eq(importSourceMappings.sourceService, "letterboxd"),
          eq(importSourceMappings.sourceUri, sourceUri)
        ),
      });
    }

    if (!existingMapping) {
      existingMapping = await db.query.importSourceMappings.findFirst({
        where: and(
          eq(importSourceMappings.sourceService, "letterboxd"),
          sql`lower(trim(${importSourceMappings.sourceTitle})) = lower(${sourceTitle.trim()})`,
          sourceYear
            ? eq(importSourceMappings.sourceYear, sourceYear)
            : sql`${importSourceMappings.sourceYear} IS NULL`
        ),
      });
    }

    if (existingMapping) {
      const isTestMapping = Boolean((existingMapping.metadata as any)?.isTestWorkspace);
      if (!isTestMapping) {
        return NextResponse.json(
          {
            error:
              "Conflicting production mapping exists. Import Lab manual resolutions cannot overwrite, re-tag, or delete verified production mappings.",
          },
          { status: 409 }
        );
      }

      // Safe to update existing test-scoped mapping with verified assignment
      await db
        .update(importSourceMappings)
        .set({
          mediaItemId: resolvedMediaId,
          confidence: "manual_verified",
          sourceMediaType: resolvedMediaType,
          sourceUri: sourceUri || existingMapping.sourceUri,
          metadata: metadataObj,
          updatedAt: new Date(),
        })
        .where(eq(importSourceMappings.id, existingMapping.id));
    } else {
      // Insert new confirmed mapping
      await db.insert(importSourceMappings).values({
        id: `map_${randomUUID()}`,
        sourceService: "letterboxd",
        sourceUri,
        sourceTitle,
        sourceYear,
        sourceMediaType: resolvedMediaType,
        mediaItemId: resolvedMediaId,
        confidence: "manual_verified",
        metadata: metadataObj,
      });
    }

    // Invalidate in-memory caches so fresh mapping immediately takes effect
    clearResolutionCache();

    // 3. Remove quarantined entry scoped strictly to test workspace
    await db
      .delete(unresolvedImportItems)
      .where(
        and(
          eq(unresolvedImportItems.id, unresolvedItemId),
          eq(unresolvedImportItems.userId, TEST_WORKSPACE_USER_ID)
        )
      );

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
