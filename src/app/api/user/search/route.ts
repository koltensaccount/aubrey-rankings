import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { ilike, or, and, isNotNull, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim();

  if (!rawQ || rawQ.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const q = rawQ.startsWith("@") ? rawQ.slice(1).trim() : rawQ;
  if (!q || q.length < 1) {
    return NextResponse.json({ users: [] });
  }

  try {
    const matches = await db.query.user.findMany({
      where: and(
        isNotNull(user.username),
        ne(user.username, ""),
        or(
          ilike(user.name, `%${q}%`),
          ilike(user.username, `%${q}%`)
        )
      ),
      columns: {
        id: true,
        name: true,
        username: true,
        image: true,
        bio: true,
      },
      limit: 10,
    });

    return NextResponse.json({ users: matches });
  } catch (error: any) {
    console.error("[User Search Error]", error);
    return NextResponse.json(
      { error: "Failed to search users", users: [] },
      { status: 500 }
    );
  }
}
