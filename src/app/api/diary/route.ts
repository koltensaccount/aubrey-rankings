import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const entries = await db.query.diaryEntries.findMany({
      where: eq(diaryEntries.userId, session.user.id),
      orderBy: [desc(diaryEntries.watchedDate), desc(diaryEntries.createdAt)],
      limit,
      offset,
      with: {
        mediaItem: true,
        rating: true,
        review: true,
      },
    });

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error: any) {
    console.error("[Diary GET Error]", error);
    return NextResponse.json(
      { error: "Failed to retrieve diary entries" },
      { status: 500 },
    );
  }
}
