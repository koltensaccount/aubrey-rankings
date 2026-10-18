import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { db } from "@/db";
import { ratings, mediaItems } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No ZIP file uploaded." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Invalid file format. Please upload a .zip archive." }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Archive exceeds maximum permitted size of 25MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const summary = parseLetterboxdZip(buffer);
    if (summary.films.length === 0) {
      return NextResponse.json({ error: "No films found in archive." }, { status: 400 });
    }

    const userId = session.user.id;
    let newCount = 0;
    let updatedCount = 0;

    // Process films in safe sequential batches to prevent connection exhaustion
    for (const film of summary.films) {
      const releaseDate = film.year ? `${film.year}-01-01` : null;

      // 1. Find or create mediaItem
      let mediaItem = await db.query.mediaItems.findFirst({
        where: (m, { eq, and }) =>
          and(
            eq(m.mediaType, "movie"),
            sql`LOWER(${m.title}) = LOWER(${film.title.trim()})`
          ),
      });

      if (!mediaItem) {
        const mediaItemId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const [created] = await db
          .insert(mediaItems)
          .values({
            id: mediaItemId,
            mediaType: "movie",
            title: film.title.trim(),
            releaseDate,
          })
          .returning();
        mediaItem = created;
      }

      if (!mediaItem?.id) continue;

      // 2. Check existing global rating for user
      const existingRating = await db.query.ratings.findFirst({
        where: (r, { eq, and, isNull }) =>
          and(
            eq(r.userId, userId),
            eq(r.mediaItemId, mediaItem.id),
            isNull(r.collectionId)
          ),
      });

      const watchDateObj = film.watchDate ? new Date(film.watchDate) : null;

      if (existingRating) {
        // Safe update: preserve existing calculated overall scores and category scores!
        await db
          .update(ratings)
          .set({
            sourceRating: film.rating !== undefined ? film.rating : existingRating.sourceRating,
            sourceScale: 5,
            sourceService: "letterboxd",
            letterboxdUri: film.letterboxdUri || existingRating.letterboxdUri,
            reviewText: existingRating.reviewText || film.review || null,
            watchDate: existingRating.watchDate || watchDateObj,
            isWatched: true,
            updatedAt: new Date(),
          })
          .where(eq(ratings.id, existingRating.id));

        updatedCount++;
      } else {
        // Insert new rating
        const ratingId = `rate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await db.insert(ratings).values({
          id: ratingId,
          userId,
          mediaItemId: mediaItem.id,
          collectionId: null, // Global rating
          sourceRating: film.rating !== undefined ? film.rating : null,
          sourceScale: 5,
          sourceService: "letterboxd",
          letterboxdUri: film.letterboxdUri || null,
          reviewText: film.review || null,
          watchDate: watchDateObj,
          isWatched: true,
        });

        newCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedTotal: summary.films.length,
      newCount,
      updatedCount,
      message: `Successfully processed ${summary.films.length} films (${newCount} new, ${updatedCount} updated).`,
    });
  } catch (error: any) {
    console.error("[Letterboxd Execute Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute Letterboxd import." },
      { status: 500 }
    );
  }
}
