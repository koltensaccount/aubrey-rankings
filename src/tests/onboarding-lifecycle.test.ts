import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import {
  user,
  collections,
  follows,
  ratings,
  mediaItems,
  ratingSystems,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getFollowersList, getFollowingList } from "../lib/social-queries";
import { validateUsername, normalizeUsername } from "../lib/username";

describe("Account Lifecycle, Onboarding & Social Discovery", () => {
  const userA = `user_lifecycle_a_${Date.now()}`;
  const userB = `user_lifecycle_b_${Date.now()}`;
  const usernameA = `curator_a_${Date.now().toString().slice(-6)}`;
  const usernameB = `aubrey_${Date.now().toString().slice(-6)}`;
  const mediaId = `media_test_${Date.now()}`;
  const collectionId = `col_test_${Date.now()}`;

  before(async () => {
    // 1. Create User A (already onboarded with username)
    await db.insert(user).values({
      id: userA,
      name: "Alex Curator",
      username: usernameA,
      email: `${userA}@example.com`,
    });

    // 2. Create User B (Aubrey - initially signed up via email WITHOUT username)
    await db.insert(user).values({
      id: userB,
      name: "Aubrey Critic",
      username: null, // Pending onboarding
      email: `${userB}@example.com`,
    });

    // 3. User B has pre-existing rankings and ratings before completing onboarding
    await db.insert(mediaItems).values({
      id: mediaId,
      title: "Lifecycle Film",
      mediaType: "movie",
    });

    await db.insert(collections).values({
      id: collectionId,
      userId: userB,
      title: "Aubrey's Early Canon",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
    });

    await db.insert(ratings).values({
      id: randomUUID(),
      userId: userB,
      mediaItemId: mediaId,
      collectionId: collectionId,
      calculatedOverallScore: 9.0,
    });
  });

  after(async () => {
    await db.delete(ratings).where(eq(ratings.userId, userB));
    await db.delete(collections).where(eq(collections.userId, userB));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(follows).where(
      sql`${follows.followerId} IN (${userA}, ${userB}) OR ${follows.followingId} IN (${userA}, ${userB})`
    );
    await db.delete(user).where(
      sql`${user.id} IN (${userA}, ${userB})`
    );
  });

  it("1. Account A follows Account B while B has no username: listed with pending status", async () => {
    // User A follows User B
    await db.insert(follows).values({
      id: randomUUID(),
      followerId: userA,
      followingId: userB,
    });

    // A's following list shows B
    const aFollowing = await getFollowingList(userA, userA);
    const bInFollowing = aFollowing.users.find((u) => u.id === userB);
    assert.ok(bInFollowing, "User B must appear in A's following list");
    assert.equal(bInFollowing.name, "Aubrey Critic");
    assert.equal(bInFollowing.username, null, "Username must be null before onboarding");

    // B's followers list shows A
    const bFollowers = await getFollowersList(userB, userA);
    const aInFollowers = bFollowers.users.find((u) => u.id === userA);
    assert.ok(aInFollowers);
    assert.equal(aInFollowers.username, usernameA);

    // Verify UI contract: hasValidUsername is false when username is null
    const rawUsername = bInFollowing.username as string | null;
    const hasValidUsername = Boolean(rawUsername && rawUsername.trim().length > 0);
    assert.equal(hasValidUsername, false, "Must detect that B has no valid username yet");
  });

  it("2. Explore search excludes accounts without usernames", async () => {
    const { and, isNotNull, ne, or, ilike } = await import("drizzle-orm");
    const q = "Aubrey";

    // Query mimicking /api/user/search
    const matches = await db.query.user.findMany({
      where: and(
        isNotNull(user.username),
        ne(user.username, ""),
        or(ilike(user.name, `%${q}%`), ilike(user.username, `%${q}%`))
      ),
      columns: { id: true, name: true, username: true },
    });

    const bFound = matches.find((u) => u.id === userB);
    assert.equal(bFound, undefined, "User B must not appear in public search before onboarding");
  });

  it("3. User B completes onboarding: picks valid username, preserving all user data", async () => {
    // Validate candidate handle
    const validation = validateUsername(usernameB);
    assert.equal(validation.valid, true);
    assert.ok(validation.normalized);

    // Update User B profile with new username
    await db
      .update(user)
      .set({ username: validation.normalized, updatedAt: new Date() })
      .where(eq(user.id, userB));

    // Verify User B now has the normalized username
    const updatedB = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userB),
    });
    assert.equal(updatedB?.username, usernameB);
    assert.equal(updatedB?.name, "Aubrey Critic");

    // Verify all pre-existing ratings and collections are 100% intact
    const bCollections = await db.query.collections.findMany({
      where: (c, { eq }) => eq(c.userId, userB),
    });
    assert.equal(bCollections.length, 1);
    assert.equal(bCollections[0].title, "Aubrey's Early Canon");

    const bRatings = await db.query.ratings.findMany({
      where: (r, { eq }) => eq(r.userId, userB),
    });
    assert.equal(bRatings.length, 1);
    assert.equal(bRatings[0].calculatedOverallScore, 9.0);

    // Verify follow relationship is intact
    const bFollowers = await db.query.follows.findMany({
      where: (f, { eq }) => eq(f.followingId, userB),
    });
    assert.equal(bFollowers.length, 1);
    assert.equal(bFollowers[0].followerId, userA);
  });

  it("4. Account A can now find User B in Explore by name and username", async () => {
    const { and, isNotNull, ne, or, ilike } = await import("drizzle-orm");

    // Search by display name "Aubrey"
    const nameMatches = await db.query.user.findMany({
      where: and(
        isNotNull(user.username),
        ne(user.username, ""),
        or(ilike(user.name, `%Aubrey%`), ilike(user.username, `%Aubrey%`))
      ),
    });
    const bByName = nameMatches.find((u) => u.id === userB);
    assert.ok(bByName, "User B must be found by display name in Explore");
    assert.equal(bByName.username, usernameB);

    // Search by handle (with @ prefix handling)
    const rawSearch = `@${usernameB.slice(0, 5)}`;
    const cleanSearch = rawSearch.startsWith("@") ? rawSearch.slice(1).trim() : rawSearch;
    const handleMatches = await db.query.user.findMany({
      where: and(
        isNotNull(user.username),
        ne(user.username, ""),
        or(ilike(user.name, `%${cleanSearch}%`), ilike(user.username, `%${cleanSearch}%`))
      ),
    });
    const bByHandle = handleMatches.find((u) => u.id === userB);
    assert.ok(bByHandle, "User B must be found by handle search in Explore");
  });

  it("5. Followers list now renders clickable public profile links for User B", async () => {
    const aFollowing = await getFollowingList(userA, userA);
    const bInFollowing = aFollowing.users.find((u) => u.id === userB);
    assert.ok(bInFollowing);
    assert.equal(bInFollowing.username, usernameB);

    // UI contract check
    const hasValidUsername = !!(bInFollowing.username && bInFollowing.username.trim().length > 0);
    assert.equal(hasValidUsername, true, "hasValidUsername must be true now");
    const profileHref = hasValidUsername ? `/u/${encodeURIComponent(bInFollowing.username!)}` : null;
    assert.equal(profileHref, `/u/${usernameB}`);
  });

  it("6. Public profile for User B resolves cleanly (even with or without public items)", async () => {
    const targetUser = await db.query.user.findFirst({
      where: (u, { sql }) => sql`LOWER(${u.username}) = LOWER(${usernameB})`,
    });
    assert.ok(targetUser);
    assert.equal(targetUser.id, userB);
    assert.equal(targetUser.name, "Aubrey Critic");

    // Verify public collections lookup
    const publicCols = await db.query.collections.findMany({
      where: (c, { and, eq }) => and(eq(c.userId, targetUser.id), eq(c.visibility, "public")),
    });
    assert.equal(publicCols.length, 1);
  });
});
