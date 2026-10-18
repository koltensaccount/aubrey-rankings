import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { tmdb } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  const { id, seasonNumber } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tvId = parseInt(id, 10);
  const sNum = parseInt(seasonNumber, 10);

  if (isNaN(tvId) || isNaN(sNum)) {
    return NextResponse.json({ error: "Invalid TV or season parameters" }, { status: 400 });
  }

  try {
    const seasonData = await tmdb.getTvSeason(tvId, sNum);
    return NextResponse.json(seasonData);
  } catch (error: any) {
    console.error("[TMDB TV Season Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch TV season episodes" },
      { status: 500 }
    );
  }
}
