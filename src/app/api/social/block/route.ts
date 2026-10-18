import { requireRateLimit } from "@/lib/request-limits";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { userBlocks, follows, user } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

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

/**
 * GET /api/social/block - List accounts blocked by current user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blockedRows = await db.query.userBlocks.findMany({
    where: (b, { eq }) => eq(b.blockerId, session.user.id),
    with: {
      blocked: {
        columns: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  });

  const blockedUsers = blockedRows.map((r) => ({
    id: r.id,
    userId: r.blocked.id,
    name: r.blocked.name,
    username: r.blocked.username,
    image: r.blocked.image,
    blockedAt: r.createdAt,
  }));

  return NextResponse.json({ blockedUsers });
}

/**
 * POST /api/social/block - Block a user
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-block:${session.user.id}`, 30);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const targetUserId = await resolveTargetUserId(request, body);
  if (!targetUserId) {
    return NextResponse.json({ error: "Target user not specified" }, { status: 400 });
  }

  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  const targetUserExists = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, targetUserId),
    columns: { id: true },
  });

  if (!targetUserExists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Insert block record idempotently
  const existingBlock = await db.query.userBlocks.findFirst({
    where: (b, { and, eq }) =>
      and(eq(b.blockerId, session.user.id), eq(b.blockedId, targetUserId)),
  });

  if (!existingBlock) {
    await db.insert(userBlocks).values({
      id: randomUUID(),
      blockerId: session.user.id,
      blockedId: targetUserId,
    });
  }

  // Atomically terminate any reciprocal follows
  await db
    .delete(follows)
    .where(
      or(
        and(eq(follows.followerId, session.user.id), eq(follows.followingId, targetUserId)),
        and(eq(follows.followerId, targetUserId), eq(follows.followingId, session.user.id))
      )
    );

  return NextResponse.json({
    success: true,
    message: "User blocked successfully",
    isBlocked: true,
  });
}

/**
 * DELETE /api/social/block - Unblock a user
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRateLimit(`social-unblock:${session.user.id}`, 30);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const targetUserId = await resolveTargetUserId(request, body);

  if (!targetUserId) {
    return NextResponse.json({ error: "Target user not specified" }, { status: 400 });
  }

  await db
    .delete(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, session.user.id), eq(userBlocks.blockedId, targetUserId))
    );

  return NextResponse.json({
    success: true,
    message: "User unblocked successfully",
    isBlocked: false,
  });
}
