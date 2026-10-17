import { NextRequest, NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";
import { getServerSession } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const type = searchParams.get("type") || "all"; // 'tv' | 'franchise' | 'movie' | 'all'

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === "tv") {
      const data = await tmdb.searchTv(query);
      return NextResponse.json(data);
    } else if (type === "franchise") {
      const data = await tmdb.searchMovieCollections(query);
      return NextResponse.json(data);
    } else if (type === "movie") {
      const data = await tmdb.searchMovies(query);
      return NextResponse.json(data);
    } else {
      const data = await tmdb.searchMulti(query);
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error("[TMDB Search API Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to search TMDB" },
      { status: 500 }
    );
  }
}
