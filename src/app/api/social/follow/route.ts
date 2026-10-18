import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { follows, user, feedActivities } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "@/lib/notifications";

async function resolveTargetUserId(
  req: NextRequest,
  body?: { targetUserId?: string; username?: string }
): Promise<string | null> {
  const searchParams = req.nextUrl.searchParams;
  const targetId = body?.targetUserId || searchParams.get("targetUserId");
  const username = body?.username || searchParams.get("username");

  if (targetId) return targetId;
  if (username) {
    const targetUser = await db.query.user.findFirst({
      where: (u, { eq, sql }) => eq(sql`LOWER(${u.username})`, username.toLowerCase().trim()),
      columns: { id: true },
    });
    return targetUser?.id || null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const targetUserId = await resolveTargetUserId(request);

  if (!targetUserId) {
    return NextResponse.json({ error: "User not specified" }, { status: 400 });
  }

  // Count followers of targetUser
  const followersCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, targetUserId));
  const followersCount = Number(followersCountRes[0]?.count || 0);

  // Count how many people targetUser is following
  const followingCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, targetUserId));
  const followingCount = Number(followingCountRes[0]?.count || 0);

  let isFollowing = false;
  if (session) {
    const followRecord = await db.query.follows.findFirst({
      where: (f, { and, eq }) =>
        and(eq(f.followerId, session.user.id), eq(f.followingId, targetUserId)),
    });
    isFollowing = !!followRecord;
  }

  return NextResponse.json({
    isFollowing,
    followersCount,
    followingCount,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { requireRateLimit(`social-follow:${session.user.id}`,60); } catch { return NextResponse.json({error:"Too many requests"},{status:429}); }
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid request"},{status:400});
  const targetUserId = await resolveTargetUserId(request, body);

  if (!targetUserId) {
    return NextResponse.json({ error: "Target user not specified" }, { status: 400 });
  }

  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  // Verify target user exists
  const targetUserExists = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, targetUserId),
    columns: { id: true },
  });
  if (!targetUserExists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Enforce authoritative blocking policy
  const { canInteract } = await import("@/lib/safety");
  if (!(await canInteract({ actorId: session.user.id, ownerId: targetUserId }))) {
    return NextResponse.json({ error: "Cannot follow this user" }, { status: 403 });
  }

  // Insert follow record idempotently
  const existing = await db.query.follows.findFirst({
    where: (f, { and, eq }) =>
      and(eq(f.followerId, session.user.id), eq(f.followingId, targetUserId)),
  });

  if (!existing) {
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: session.user.id,
      followingId: targetUserId,
    });

    // Notify target user
    const actor = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, session.user.id),
      columns: { name: true, username: true, image: true },
    });

    await createNotification({
      recipientUserId: targetUserId,
      actorUserId: session.user.id,
      notificationType: "follow",
      deduplicationKey: `follow:${session.user.id}:${targetUserId}`,
      metadata: {
        actorName: actor?.name || session.user.name || "Someone",
        actorUsername: actor?.username || null,
        actorImage: actor?.image || session.user.image || null,
        message: `${actor?.name || session.user.name || "Someone"} started following you.`,
        targetUrl: actor?.username ? `/u/${actor.username}` : `/profile`,
      },
    });
  }

  // Recalculate counts
  const followersCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, targetUserId));
  const followersCount = Number(followersCountRes[0]?.count || 0);

  const followingCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, targetUserId));
  const followingCount = Number(followingCountRes[0]?.count || 0);

  return NextResponse.json({
    isFollowing: true,
    followersCount,
    followingCount,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error:"Invalid request"},{status:400});
  const targetUserId = await resolveTargetUserId(request, body);

  if (!targetUserId) {
    return NextResponse.json({ error: "Target user not specified" }, { status: 400 });
  }

  await db
    .delete(follows)
    .where(
      and(eq(follows.followerId, session.user.id), eq(follows.followingId, targetUserId))
    );

  const followersCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, targetUserId));
  const followersCount = Number(followersCountRes[0]?.count || 0);

  const followingCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, targetUserId));
  const followingCount = Number(followingCountRes[0]?.count || 0);

  return NextResponse.json({
    isFollowing: false,
    followersCount,
    followingCount,
  });
}
