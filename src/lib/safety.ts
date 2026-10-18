import { db } from "@/db";
import { userBlocks, follows, user, collections } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

/**
 * Checks if a bidirectional block exists between two users.
 * Returns true if userA blocked userB OR userB blocked userA.
 */
export async function isBlocked(userAId: string, userBId: string): Promise<boolean> {
  if (!userAId || !userBId || userAId === userBId) return false;

  const existing = await db.query.userBlocks.findFirst({
    where: (b, { or, and, eq }) =>
      or(
        and(eq(b.blockerId, userAId), eq(b.blockedId, userBId)),
        and(eq(b.blockerId, userBId), eq(b.blockedId, userAId))
      ),
    columns: { id: true },
  });

  return Boolean(existing);
}

/**
 * Returns a Set of all user IDs that have either blocked userId or are blocked by userId.
 * Used to filter feeds, discovery, comments, reviews, and social search.
 */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();

  const rows = await db
    .select({
      blockerId: userBlocks.blockerId,
      blockedId: userBlocks.blockedId,
    })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));

  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerId !== userId) ids.add(r.blockerId);
    if (r.blockedId !== userId) ids.add(r.blockedId);
  }
  return ids;
}

/**
 * Authoritative check for whether a user can interact with another user's content.
 * Returns false if either party has blocked the other.
 */
export async function canInteract({
  actorId,
  ownerId,
}: {
  actorId: string;
  ownerId: string;
}): Promise<boolean> {
  if (!actorId || !ownerId || actorId === ownerId) return true;
  return !(await isBlocked(actorId, ownerId));
}

/**
 * Authoritative check for comment eligibility across rankings and reviews.
 * Enforces collection-level toggles, bidirectional blocking, and author-level
 * comment permissions ('everyone' | 'following' | 'nobody').
 *
 * NOTE: "following" means the author follows the commenter (i.e. trusted curators).
 */
export async function canComment({
  authorId,
  commenterId,
  collectionAllowComments = true,
}: {
  authorId: string;
  commenterId: string;
  collectionAllowComments?: boolean;
}): Promise<{ allowed: boolean; reason?: string }> {
  // The content author can always comment on their own work
  if (authorId === commenterId) {
    return { allowed: true };
  }

  // 1. Collection-level override (ranking owner turned off comments for this ranking)
  if (!collectionAllowComments) {
    return { allowed: false, reason: "Comments are disabled for this ranking" };
  }

  // 2. Bidirectional block check
  if (await isBlocked(authorId, commenterId)) {
    return { allowed: false, reason: "You cannot interact with this content" };
  }

  // 3. Author user-level comment permissions
  const author = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, authorId),
    columns: { commentPermission: true },
  });

  const permission = author?.commentPermission || "everyone";

  if (permission === "nobody") {
    return { allowed: false, reason: "The author has disabled comments" };
  }

  if (permission === "following") {
    // Check if the content author follows the commenter
    const followRecord = await db.query.follows.findFirst({
      where: (f, { and, eq }) =>
        and(eq(f.followerId, authorId), eq(f.followingId, commenterId)),
      columns: { id: true },
    });

    if (!followRecord) {
      return {
        allowed: false,
        reason: "Only curators followed by the author may comment",
      };
    }
  }

  return { allowed: true };
}
