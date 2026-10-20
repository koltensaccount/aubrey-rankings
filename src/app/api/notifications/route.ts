import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
import { getBlockedUserIds } from "@/lib/safety";
import { notificationLinks } from "@/lib/notification-links";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(1, Math.floor(Number(searchParams.get("limit")) || 30)), 100);
  const unreadOnly = searchParams.get("unread") === "true";

  const blockedUserIds = await getBlockedUserIds(session.user.id);
  const blockedArray = Array.from(blockedUserIds);

  const blockedFilter =
    blockedArray.length > 0
      ? sql`(${notifications.actorUserId} IS NULL OR ${notifications.actorUserId} NOT IN ${blockedArray})`
      : sql`true`;

  const accessibilityFilter = sql`(${notifications.collectionId} IS NULL OR EXISTS (SELECT 1 FROM collections c WHERE c.id = ${notifications.collectionId} AND (c.user_id = ${session.user.id} OR c.visibility IN ('public','unlisted'))))`;

  // Calculate unread count
  const unreadCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        accessibilityFilter,
        blockedFilter,
        isNull(notifications.readAt)
      )
    );
  const unreadCount = Number(unreadCountRes[0]?.count || 0);

  // Fetch list
  const whereClause = unreadOnly
    ? and(
        eq(notifications.recipientUserId, session.user.id),
        accessibilityFilter,
        blockedFilter,
        isNull(notifications.readAt)
      )
    : and(
        eq(notifications.recipientUserId, session.user.id),
        accessibilityFilter,
        blockedFilter
      );

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
    notifications: list.map((item) => ({ ...item, links: notificationLinks(item) })),
    unreadCount,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body) || (body.markAll !== undefined && typeof body.markAll !== "boolean") || (body.id !== undefined && typeof body.id !== "string")) return NextResponse.json({error:"Invalid notification update"},{status:400});
  const { markAll, id } = body;

  const now = new Date();

  if (markAll) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.recipientUserId, session.user.id),
        sql`(${notifications.collectionId} IS NULL OR EXISTS (SELECT 1 FROM collections c WHERE c.id = ${notifications.collectionId} AND (c.user_id = ${session.user.id} OR c.visibility IN ('public','unlisted'))))`,
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
  const blockedUserIds = await getBlockedUserIds(session.user.id);
  const blockedArray = Array.from(blockedUserIds);
  const blockedFilter =
    blockedArray.length > 0
      ? sql`(${notifications.actorUserId} IS NULL OR ${notifications.actorUserId} NOT IN ${blockedArray})`
      : sql`true`;
  const accessibilityFilter = sql`(${notifications.collectionId} IS NULL OR EXISTS (SELECT 1 FROM collections c WHERE c.id = ${notifications.collectionId} AND (c.user_id = ${session.user.id} OR c.visibility IN ('public','unlisted'))))`;

  const unreadCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, session.user.id),
        accessibilityFilter,
        blockedFilter,
        isNull(notifications.readAt)
      )
    );
  const unreadCount = Number(unreadCountRes[0]?.count || 0);

  return NextResponse.json({
    success: true,
    unreadCount,
  });
}
