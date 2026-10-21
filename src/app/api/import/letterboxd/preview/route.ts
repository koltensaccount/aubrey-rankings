import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { previewLetterboxdImport } from "@/lib/letterboxd-import";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No ZIP file uploaded." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        {
          error:
            "Invalid file format. Please upload an official Letterboxd ZIP archive.",
        },
        { status: 400 },
      );
    }

    // Limit archive size to 25MB
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Archive exceeds maximum permitted size of 25MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let summary;
    try {
      summary = parseLetterboxdZip(buffer);
    } catch (parseErr: any) {
      return NextResponse.json(
        {
          error:
            "Failed to parse ZIP archive. Ensure it is an uncorrupted Letterboxd export.",
        },
        { status: 400 },
      );
    }

    const hasImportableData =
      summary.totalUniqueFilms > 0 ||
      summary.totalWatchlistItems > 0 ||
      summary.totalCustomLists > 0 ||
      summary.totalDiaryEntries > 0 ||
      summary.totalReviews > 0;

    if (!hasImportableData) {
      return NextResponse.json(
        {
          error:
            "No importable records found in the archive. The ZIP does not contain ratings, reviews, diary logs, a watchlist, or custom lists.",
        },
        { status: 400 },
      );
    }

    const previewResult = await previewLetterboxdImport(
      session.user.id,
      summary,
    );

    return NextResponse.json({
      success: true,
      ...previewResult,
    });
  } catch (error: any) {
    console.error("[Letterboxd Preview Error]", error);
    return NextResponse.json(
      { error: "Failed to process Letterboxd archive." },
      { status: 500 },
    );
  }
}
