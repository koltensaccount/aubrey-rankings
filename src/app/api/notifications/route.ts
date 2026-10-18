import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, sql, desc, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);
  const unreadOnly = searchParams.get("unread") === "true";

  // Calculate unread count
  const unreadCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        isNull(notifications.readAt)
      )
    );
  const unreadCount = Number(unreadCountRes[0]?.count || 0);

  // Fetch list
  const whereClause = unreadOnly
    ? and(
        eq(notifications.recipientUserId, session.user.id),
        isNull(notifications.readAt)
      )
    : eq(notifications.recipientUserId, session.user.id);

  const list = await db.query.notifications.findMany({
    where: whereClause,
    orderBy: [desc(notifications.createdAt)],
    limit,
    with: {
      actor: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json({
    notifications: list,
    unreadCount,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { markAll, id } = body;

  const now = new Date();

  if (markAll) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.recipientUserId, session.user.id),
          isNull(notifications.readAt)
        )
      );
  } else if (id) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientUserId, session.user.id)
        )
      );
  } else {
    return NextResponse.json({ error: "Missing markAll or id" }, { status: 400 });
  }

  // Recalculate remaining unread count
  const unreadCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        isNull(notifications.readAt)
      )
    );
  const unreadCount = Number(unreadCountRes[0]?.count || 0);

  return NextResponse.json({
    success: true,
    unreadCount,
  });
}
