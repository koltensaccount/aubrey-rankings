import { db } from "@/db";
import { follows, user } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export interface SocialUserItem {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  isFollowing: boolean;
  isSelf: boolean;
}

export async function getFollowersList(
  targetUserId: string,
  viewerUserId?: string | null
): Promise<{ users: SocialUserItem[]; total: number }> {
  const followRecords = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bio: user.bio,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(user, eq(follows.followerId, user.id))
    .where(eq(follows.followingId, targetUserId))
    .orderBy(sql`${follows.createdAt} DESC`);

  const userIds = followRecords.map((r) => r.id);

  // Determine which of these users the viewer is currently following
  const viewerFollowingSet = new Set<string>();
  if (viewerUserId && userIds.length > 0) {
    const viewerFollows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerUserId),
          inArray(follows.followingId, userIds)
        )
      );
    viewerFollows.forEach((f) => viewerFollowingSet.add(f.followingId));
  }

  const items: SocialUserItem[] = followRecords.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username && r.username.trim().length > 0 ? r.username.trim() : null,
    image: r.image || null,
    bio: r.bio || null,
    isFollowing: viewerFollowingSet.has(r.id),
    isSelf: viewerUserId === r.id,
  }));

  return { users: items, total: items.length };
}

export async function getFollowingList(
  targetUserId: string,
  viewerUserId?: string | null
): Promise<{ users: SocialUserItem[]; total: number }> {
  const followRecords = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bio: user.bio,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(user, eq(follows.followingId, user.id))
    .where(eq(follows.followerId, targetUserId))
    .orderBy(sql`${follows.createdAt} DESC`);

  const userIds = followRecords.map((r) => r.id);

  const viewerFollowingSet = new Set<string>();
  if (viewerUserId && userIds.length > 0) {
    const viewerFollows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerUserId),
          inArray(follows.followingId, userIds)
        )
      );
    viewerFollows.forEach((f) => viewerFollowingSet.add(f.followingId));
  }

  const items: SocialUserItem[] = followRecords.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username && r.username.trim().length > 0 ? r.username.trim() : null,
    image: r.image || null,
    bio: r.bio || null,
    isFollowing: viewerFollowingSet.has(r.id),
    isSelf: viewerUserId === r.id,
  }));

  return { users: items, total: items.length };
}
