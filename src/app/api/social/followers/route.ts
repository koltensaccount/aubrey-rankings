import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { user } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getFollowersList } from "@/lib/social-queries";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const searchParams = request.nextUrl.searchParams;
  let targetUserId = searchParams.get("userId");
  const username = searchParams.get("username");

  if (!targetUserId && username) {
    const targetUser = await db.query.user.findFirst({
      where: (u, { eq, sql }) =>
        eq(sql`LOWER(${u.username})`, username.toLowerCase().trim()),
      columns: { id: true },
    });
    targetUserId = targetUser?.id || null;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "User not specified" }, { status: 400 });
  }

  const result = await getFollowersList(targetUserId, session?.user?.id);
  return NextResponse.json(result);
}
