import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { db } from "@/db";
import { ratings, mediaItems } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

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
      return NextResponse.json(
        { error: "Invalid file format. Please upload an official Letterboxd ZIP archive." },
        { status: 400 }
      );
    }

    // Limit archive size to 25MB
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Archive exceeds maximum permitted size of 25MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let summary;
    try {
      summary = parseLetterboxdZip(buffer);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: "Failed to parse ZIP archive. Ensure it is an uncorrupted Letterboxd export." },
        { status: 400 }
      );
    }

    if (summary.totalUniqueFilms === 0) {
      return NextResponse.json(
        { error: "No valid film records, ratings, or watch history found in the ZIP archive." },
        { status: 400 }
      );
    }

    // Retrieve user's existing global ratings to compute diff
    const userRatings = await db
      .select({
        id: ratings.id,
        mediaItemId: ratings.mediaItemId,
        sourceRating: ratings.sourceRating,
        reviewText: ratings.reviewText,
        letterboxdUri: ratings.letterboxdUri,
      })
      .from(ratings)
      .where(and(eq(ratings.userId, session.user.id), isNull(ratings.collectionId)));

    const existingUriMap = new Set<string>();
    for (const r of userRatings) {
      if (r.letterboxdUri) {
        existingUriMap.add(r.letterboxdUri.toLowerCase().trim());
      }
    }

    let newCount = 0;
    let existingCount = 0;

    for (const film of summary.films) {
      if (film.letterboxdUri && existingUriMap.has(film.letterboxdUri.toLowerCase().trim())) {
        existingCount++;
      } else {
        newCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalFilms: summary.totalUniqueFilms,
      totalRatings: summary.totalRatings,
      totalReviews: summary.totalReviews,
      totalWatched: summary.totalWatched,
      newCount,
      existingCount,
      sampleFilms: summary.films.slice(0, 10).map((f) => ({
        title: f.title,
        year: f.year,
        rating: f.rating ?? null,
        hasReview: !!f.review,
        watchDate: f.watchDate ?? null,
      })),
    });
  } catch (error: any) {
    console.error("[Letterboxd Preview Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process Letterboxd archive." },
      { status: 500 }
    );
  }
}
