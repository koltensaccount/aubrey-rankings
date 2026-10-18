import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { tmdb } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tvId = parseInt(id, 10);
  if (isNaN(tvId) || tvId <= 0) {
    return NextResponse.json({ error: "Invalid TV show ID" }, { status: 400 });
  }

  try {
    const details = await tmdb.getTvDetails(tvId);
    return NextResponse.json(details);
  } catch (error: any) {
    console.error("[TMDB TV Details Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch TV details" },
      { status: 500 }
    );
  }
}
