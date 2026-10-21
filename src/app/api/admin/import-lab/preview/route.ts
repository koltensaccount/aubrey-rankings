import { NextRequest, NextResponse } from "next/server";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { KNOWN_TV_EXCEPTIONS } from "@/lib/letterboxd-matching";
import { verifyAdminOrTestSession } from "@/lib/test-workspace";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No archive file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const summary = parseLetterboxdZip(buffer);

    // Identify detected TV exceptions
    const detectedTvExceptions: Array<{
      title: string;
      year: number | null;
      seriesTitle: string;
      seasonNumber: number;
      episodeNumber: number;
    }> = [];

    const checkFilm = (f: { title: string; year: number | null }) => {
      const match = KNOWN_TV_EXCEPTIONS.find((e) => e.pattern.test(f.title.trim()));
      if (match && !detectedTvExceptions.some((d) => d.title.toLowerCase() === f.title.toLowerCase())) {
        detectedTvExceptions.push({
          title: f.title,
          year: f.year,
          seriesTitle: match.seriesTitle,
          seasonNumber: match.seasonNumber,
          episodeNumber: match.episodeNumber,
        });
      }
    };

    summary.films.forEach(checkFilm);
    summary.diaryEntries.forEach(checkFilm);
    summary.reviews.forEach(checkFilm);

    return NextResponse.json({
      success: true,
      preview: {
        totalUniqueFilms: summary.totalUniqueFilms,
        totalRatings: summary.totalRatings,
        totalReviews: summary.totalReviews,
        totalWatched: summary.totalWatched,
        totalDiaryEntries: summary.totalDiaryEntries,
        watchlistCount: summary.watchlist.length,
        customListsCount: summary.customLists.length,
        unsupportedItems: summary.unsupportedItems || [],
        detectedTvExceptions,
        sampleFilms: summary.films.slice(0, 10).map((f) => ({
          title: f.title,
          year: f.year,
          rating: f.rating,
          isWatched: f.isWatched,
          isFavorite: f.isFavorite,
        })),
        sampleDiary: summary.diaryEntries.slice(0, 5),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to parse Letterboxd ZIP archive" },
      { status: 400 }
    );
  }
}
