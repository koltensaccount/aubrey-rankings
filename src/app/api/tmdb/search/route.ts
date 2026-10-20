import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";
import { getServerSession } from "@/lib/server-session";

const cache = new Map<string, { expires: number; value: unknown }>();
const VALID_TYPES = new Set(["all", "tv", "movie", "franchise"]);
function cacheResult(key: string, value: unknown) {
  if (cache.size >= 250) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: Date.now() + 5 * 60_000, value });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);

  try { requireRateLimit(`tmdb-search:${session?.user.id || "anonymous"}`, session ? 60 : 20); } catch { return NextResponse.json({error:"Too many searches. Please try again shortly."},{status:429}); }
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const type = searchParams.get("type") || "all"; // 'tv' | 'franchise' | 'movie' | 'all'

  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "Invalid search type" }, { status: 400 });
  if (query && query.length > 100) return NextResponse.json({error:"Search is too long"},{status:400});
  if (!query) {
    return NextResponse.json({ results: [] });
  }
  if (query.length < 2) return NextResponse.json({ error: "Enter at least two characters" }, { status: 400 });

  const cacheKey = `${type}:${query.toLocaleLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });

  try {
    if (type === "tv") {
      const data = await tmdb.searchTv(query);
      cacheResult(cacheKey, data);
      return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    } else if (type === "franchise") {
      const data = await tmdb.searchMovieCollections(query);
      cacheResult(cacheKey, data);
      return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    } else if (type === "movie") {
      const data = await tmdb.searchMovies(query);
      cacheResult(cacheKey, data);
      return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    } else {
      const data = await tmdb.searchMulti(query);
      cacheResult(cacheKey, data);
      return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    }
  } catch (error: any) {
    console.error("[TMDB Search API Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to search TMDB" },
      { status: 503 }
    );
  }
}
