import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { user, follows } from "@/db/schema";
import { ilike, or, and, isNotNull, ne, inArray, eq } from "drizzle-orm";

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
    const session = await getServerSession();
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

    let followingSet = new Set<string>();
    if (session?.user?.id && matches.length > 0) {
      const matchIds = matches.map((m) => m.id);
      const followRows = await db.query.follows.findMany({
        where: and(
          eq(follows.followerId, session.user.id),
          inArray(follows.followingId, matchIds)
        ),
        columns: { followingId: true },
      });
      followingSet = new Set(followRows.map((r) => r.followingId));
    }

    const usersWithStatus = matches.map((u) => ({
      ...u,
      isFollowing: followingSet.has(u.id),
      isSelf: session?.user?.id === u.id,
    }));

    return NextResponse.json({ users: usersWithStatus });
  } catch (error: any) {
    console.error("[User Search Error]", error);
    return NextResponse.json(
      { error: "Failed to search users", users: [] },
      { status: 500 }
    );
  }
}
