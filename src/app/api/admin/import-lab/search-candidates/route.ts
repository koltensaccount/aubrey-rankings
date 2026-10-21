import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { tmdb } from "@/lib/tmdb";
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
  const query = body.query ? String(body.query).trim() : "";

  if (!query) {
    return NextResponse.json({ candidates: [] });
  }

  try {
    const movieResults = await tmdb.searchMovies(query);
    const multiResults = await tmdb.searchMulti(query);

    const candidatesMap = new Map<number, any>();

    for (const m of movieResults?.results || []) {
      candidatesMap.set(m.id, {
        id: m.id,
        title: m.title,
        year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) || null : null,
        mediaType: "movie",
        posterPath: m.poster_path,
        overview: m.overview,
        voteAverage: m.vote_average,
      });
    }

    for (const item of multiResults?.results || []) {
      if (!candidatesMap.has(item.id) && (item.media_type === "movie" || item.media_type === "tv")) {
        candidatesMap.set(item.id, {
          id: item.id,
          title: item.title || item.name,
          year: item.release_date
            ? parseInt(item.release_date.slice(0, 4), 10) || null
            : item.first_air_date
              ? parseInt(item.first_air_date.slice(0, 4), 10) || null
              : null,
          mediaType: item.media_type,
          posterPath: item.poster_path,
          overview: item.overview,
          voteAverage: item.vote_average,
        });
      }
    }

    return NextResponse.json({
      candidates: Array.from(candidatesMap.values()).slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to query TMDB candidates" },
      { status: 500 }
    );
  }
}
