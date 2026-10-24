import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { getUserUnifiedTimeline, type ActivityFilter } from "@/lib/timeline-activity";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") || "0", 10);
    const requestedFilter = searchParams.get("filter") || "all";
    const filters: ActivityFilter[] = ["all", "viewings", "reviews", "ratings", "watchlist", "films", "tv", "rewatches"];
    const filter = filters.find((value) => value === requestedFilter);
    if (!filter || !Number.isFinite(limitParam) || !Number.isFinite(offsetParam)) return NextResponse.json({ error: "Invalid timeline pagination or filter" }, { status: 400 });

    const result = await getUserUnifiedTimeline(session.user.id, {
      limit: limitParam,
      offset: offsetParam,
      filter,
    });

    return NextResponse.json({
      success: true,
      entries: result.entries,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      undatedEntries: result.undatedEntries,
    });
  } catch (error: any) {
    console.error("[Activity GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve activity timeline" },
      { status: 500 }
    );
  }
}
