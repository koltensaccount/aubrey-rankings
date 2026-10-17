import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import {
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  categoryScores,
  ratingSystems,
  ratingCategories,
} from "@/db/schema";
import { BLACK_MIRROR_EPISODES, findMatchingEpisode } from "@/lib/importer";
import { calculateWeightedAverage } from "@/lib/scoring";
import { nanoid } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rows, collectionTitle = "Aubrey's Correct Black Mirror Ratings" } = body;

    // 1. Get or create user's default rating system
    let defaultRs = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.userId, session.user.id), eq(rs.isDefault, true)),
      with: {
        categories: true,
      },
    });

    if (!defaultRs) {
      return NextResponse.json(
        { error: "No rating system found for user" },
        { status: 400 }
      );
    }

    // 2. Create collection for imported ratings
    const colId = `col_bm_${Date.now()}_${nanoid(6)}`;
    await db.insert(collections).values({
      id: colId,
      userId: session.user.id,
      title: collectionTitle,
      description: "Imported historical ratings from Aubrey's spreadsheet.",
      collectionType: "tv_show",
      tmdbId: 42009, // Black Mirror TMDB ID
      defaultRatingSystemId: defaultRs.id,
      isPinned: true,
    });

    // Match categories by name
    const catMap: Record<string, any> = {};
    for (const c of defaultRs.categories) {
      const lower = c.name.toLowerCase();
      if (lower.includes("music") || lower.includes("sound")) catMap.music = c;
      if (lower.includes("acting")) catMap.acting = c;
      if (lower.includes("cinemat")) catMap.cinematography = c;
      if (lower.includes("writing")) catMap.writing = c;
      if (lower.includes("vibe")) catMap.vibes = c;
    }

    let importedCount = 0;
    let sortIdx = 0;

    for (const item of BLACK_MIRROR_EPISODES) {
      sortIdx++;
      const mediaId = `tv_42009_s${item.season}_e${item.episode}`;

      // Insert mediaItem
      await db
        .insert(mediaItems)
        .values({
          id: mediaId,
          mediaType: "episode",
          title: item.title,
          seasonNumber: item.season,
          episodeNumber: item.episode,
          tmdbId: 42009,
        })
        .onConflictDoNothing();

      // Add collection entry
      await db
        .insert(collectionEntries)
        .values({
          id: `entry_${Date.now()}_${nanoid(6)}`,
          collectionId: colId,
          mediaItemId: mediaId,
          sortOrder: sortIdx,
        })
        .onConflictDoNothing();

      // Check if input row exists for this episode
      const matchedRow = Array.isArray(rows)
        ? rows.find((r: any) => {
            const m = findMatchingEpisode(r.title || "");
            return m && m.season === item.season && m.episode === item.episode;
          })
        : null;

      if (matchedRow) {
        const scores: Record<string, number> = {};
        if (matchedRow.music && catMap.music) scores[catMap.music.id] = Number(matchedRow.music);
        if (matchedRow.acting && catMap.acting) scores[catMap.acting.id] = Number(matchedRow.acting);
        if (matchedRow.cinematography && catMap.cinematography)
          scores[catMap.cinematography.id] = Number(matchedRow.cinematography);
        if (matchedRow.writing && catMap.writing) scores[catMap.writing.id] = Number(matchedRow.writing);
        if (matchedRow.vibes && catMap.vibes) scores[catMap.vibes.id] = Number(matchedRow.vibes);

        const calc = calculateWeightedAverage(defaultRs.categories, scores);
        const ratingId = `rate_bm_${Date.now()}_${nanoid(6)}`;

        await db.insert(ratings).values({
          id: ratingId,
          userId: session.user.id,
          mediaItemId: mediaId,
          collectionId: colId,
          ratingSystemId: defaultRs.id,
          calculatedOverallScore: calc.weightedScore,
          isWatched: true,
          reviewText: matchedRow.notes || null,
        });

        for (const [catId, sc] of Object.entries(scores)) {
          const appliedWeight =
            defaultRs.categories.find((c) => c.id === catId)?.weight || 1.0;
          await db.insert(categoryScores).values({
            id: `cs_${ratingId}_${catId}`,
            ratingId,
            categoryId: catId,
            score: sc,
            weightApplied: appliedWeight,
          });
        }
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      collectionId: colId,
      importedCount,
    });
  } catch (error: any) {
    console.error("[Import Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import ratings" },
      { status: 500 }
    );
  }
}
