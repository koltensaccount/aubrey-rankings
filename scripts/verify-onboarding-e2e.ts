import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { db, pool } from "../src/db";
import {
  user,
  session,
  account,
  follows,
  notifications,
  feedActivities,
} from "../src/db/schema";
import { inArray, sql } from "drizzle-orm";

// Enforce safe loopback execution by default to protect production environments
const BASE_URL = process.env.TARGET_URL || process.env.E2E_BASE_URL || "http://localhost:3100";
const loopback = ["localhost", "127.0.0.1", "[::1]"];
const targetUrl = new URL(BASE_URL);

if (!loopback.includes(targetUrl.hostname)) {
  throw new Error(
    `SAFETY VIOLATION: E2E onboarding verification script must only target a local loopback test server (got: ${BASE_URL}). Running against remote/production environments is strictly prohibited.`
  );
}

if (process.env.DATABASE_URL) {
  const dbUrl = new URL(process.env.DATABASE_URL);
  if (!loopback.includes(dbUrl.hostname)) {
    throw new Error(
      `SAFETY VIOLATION: Database connection must target a local loopback instance (got: ${process.env.DATABASE_URL}).`
    );
  }
}

const tag = randomUUID().slice(0, 6);
const userA = {
  name: `Alex Curator ${tag}`,
  email: `e2e-alex-${tag}@aubrey-test.internal`,
  password: randomBytes(16).toString("hex"),
  username: `alex_${tag}`,
};

const userB = {
  name: `Aubrey Testing ${tag}`,
  email: `e2e-aubrey-${tag}@aubrey-test.internal`,
  password: randomBytes(16).toString("hex"),
  username: `aubrey_${tag}`,
};

const createdUserIds: string[] = [];
const emails = [userA.email, userB.email];

async function api(path: string, options: { method?: string; body?: any; cookie?: string } = {}) {
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    ...(options.cookie ? { Cookie: options.cookie } : {}),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const cookies = res.headers.getSetCookie?.() || [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => "");
  }

  return { res, status: res.status, data, cookie: cookieHeader };
}

(async () => {
  console.log(`Starting isolated E2E onboarding and social verification against: ${BASE_URL}\n`);

  try {
    // ----------------------------------------------------
    // Step 1: Sign up Account A and complete onboarding
    // ----------------------------------------------------
    console.log("1. Signing up Account A...");
    const signupA = await api("/api/auth/sign-up/email", {
      method: "POST",
      body: { name: userA.name, email: userA.email, password: userA.password },
    });
    assert.equal(signupA.status, 200, "Account A signup failed");
    const cookieA = signupA.cookie;
    const idA = signupA.data?.user?.id;
    assert.ok(idA, "Account A missing ID");
    createdUserIds.push(idA);

    const onboardA = await api("/api/user/profile", {
      method: "PATCH",
      cookie: cookieA,
      body: { username: userA.username },
    });
    assert.equal(onboardA.status, 200, "Account A onboarding failed");
    console.log(`   -> Account A created and onboarded: ${userA.name} (@${userA.username})`);

    // ----------------------------------------------------
    // Step 2: Sign up Account B (starts with NO username)
    // ----------------------------------------------------
    console.log("\n2. Signing up Account B (initially without username)...");
    const signupB = await api("/api/auth/sign-up/email", {
      method: "POST",
      body: { name: userB.name, email: userB.email, password: userB.password },
    });
    assert.equal(signupB.status, 200, "Account B signup failed");
    const cookieB = signupB.cookie;
    const idB = signupB.data?.user?.id;
    assert.ok(idB, "Account B missing ID");
    createdUserIds.push(idB);

    // Verify Account B profile has username === null
    const profileB1 = await api("/api/user/profile", { cookie: cookieB });
    assert.equal(profileB1.status, 200);
    assert.equal(profileB1.data?.user?.username, null, "Account B must initially have null username");
    console.log(`   -> Account B created: ${userB.name} (username: null)`);

    // ----------------------------------------------------
    // Step 3: Account A follows Account B
    // ----------------------------------------------------
    console.log("\n3. Account A follows Account B...");
    const followRes = await api("/api/social/follow", {
      method: "POST",
      cookie: cookieA,
      body: { targetUserId: idB },
    });
    assert.equal(followRes.status, 200, "Follow request failed");
    assert.equal(followRes.data?.isFollowing, true);

    // ----------------------------------------------------
    // Step 4: Account A's Following list shows Account B as pending onboarding
    // ----------------------------------------------------
    console.log("\n4. Checking Account A's Following list...");
    const followingRes1 = await api(`/api/social/following?userId=${idA}`, { cookie: cookieA });
    assert.equal(followingRes1.status, 200);
    const bInFollowing1 = followingRes1.data?.users?.find((u: any) => u.id === idB);
    assert.ok(bInFollowing1, "User B must be in A's following list");
    assert.equal(bInFollowing1.username, null);
    const hasValidUsername1 = Boolean(bInFollowing1.username && bInFollowing1.username.trim().length > 0);
    assert.equal(hasValidUsername1, false, "Must detect that B has no username yet");
    console.log(`   -> User B appears in A's following list with pending onboarding status (unclickable link protected)`);

    // ----------------------------------------------------
    // Step 5: Explore search excludes Account B before onboarding
    // ----------------------------------------------------
    console.log("\n5. Searching Explore for User B before onboarding...");
    const search1 = await api(`/api/user/search?q=${encodeURIComponent(userB.name)}`);
    assert.equal(search1.status, 200);
    const bFound1 = search1.data?.users?.find((u: any) => u.id === idB);
    assert.equal(bFound1, undefined, "User B must not appear in public search before onboarding");
    console.log(`   -> Explore search correctly excludes account pending onboarding`);

    // ----------------------------------------------------
    // Step 6: Verify in-app follow notification and read-state
    // ----------------------------------------------------
    console.log("\n6. Verifying notification delivered to Account B...");
    const notifsRes = await api("/api/notifications", { cookie: cookieB });
    assert.equal(notifsRes.status, 200, "Fetching notifications failed");
    assert.ok(notifsRes.data?.unreadCount >= 1, "Must have at least 1 unread notification");
    const followNotif = notifsRes.data?.notifications?.find(
      (n: any) => n.notificationType === "follow" && n.actor?.username === userA.username
    );
    assert.ok(followNotif, "User B must have received a follow notification from User A");
    console.log(`   -> Follow notification received by User B from @${followNotif.actor?.username}`);

    // Mark notification as read
    const markReadRes = await api("/api/notifications", {
      method: "PATCH",
      cookie: cookieB,
      body: { id: followNotif.id },
    });
    assert.equal(markReadRes.status, 200, "Marking notification read failed");
    const notifsAfterRead = await api("/api/notifications", { cookie: cookieB });
    assert.equal(notifsAfterRead.data?.unreadCount, 0, "Unread count must be 0 after marking read");
    console.log(`   -> Follow notification marked as read, unread count now 0`);

    // ----------------------------------------------------
    // Step 7: Check username availability
    // ----------------------------------------------------
    console.log("\n7. Checking username availability...");
    const checkTaken = await api(`/api/user/check-username?username=${encodeURIComponent(userA.username)}`, {
      cookie: cookieB,
    });
    assert.equal(checkTaken.status, 200);
    assert.equal(checkTaken.data?.available, false, "Taken username must report unavailable");

    const checkAvail = await api(`/api/user/check-username?username=${encodeURIComponent(userB.username)}`, {
      cookie: cookieB,
    });
    assert.equal(checkAvail.status, 200);
    assert.equal(checkAvail.data?.available, true, "New username must report available");
    console.log(`   -> Username collision check validated (taken: false, available: true)`);

    // ----------------------------------------------------
    // Step 8: Account B completes onboarding
    // ----------------------------------------------------
    console.log("\n8. Account B completes username onboarding...");
    const onboardB = await api("/api/user/profile", {
      method: "PATCH",
      cookie: cookieB,
      body: { username: userB.username, bio: "Obsessive cinematic cataloger." },
    });
    assert.equal(onboardB.status, 200, "Account B profile onboarding failed");
    assert.equal(onboardB.data?.user?.username, userB.username);
    console.log(`   -> Account B successfully secured username: @${userB.username}`);

    // ----------------------------------------------------
    // Step 9: Explore search for User B after onboarding
    // ----------------------------------------------------
    console.log("\n9. Searching Explore for User B after onboarding...");
    // 9a: By display name
    const searchName = await api(`/api/user/search?q=${encodeURIComponent(userB.name)}`);
    assert.equal(searchName.status, 200);
    const bByName = searchName.data?.users?.find((u: any) => u.id === idB);
    assert.ok(bByName, "User B must appear in Explore search by display name");
    assert.equal(bByName.username, userB.username);
    console.log(`   -> Found in Explore by display name: ${bByName.name} (@${bByName.username})`);

    // 9b: By handle with @ prefix
    const searchHandle = await api(`/api/user/search?q=${encodeURIComponent("@" + userB.username)}`);
    assert.equal(searchHandle.status, 200);
    const bByHandle = searchHandle.data?.users?.find((u: any) => u.id === idB);
    assert.ok(bByHandle, "User B must appear in Explore search by @handle");
    console.log(`   -> Found in Explore by @handle: @${bByHandle.username}`);

    // ----------------------------------------------------
    // Step 10: Follower / Following profile links active
    // ----------------------------------------------------
    console.log("\n10. Checking Following & Followers lists for active profile links...");
    const followingRes2 = await api(`/api/social/following?userId=${idA}`, { cookie: cookieA });
    assert.equal(followingRes2.status, 200);
    const bInFollowing2 = followingRes2.data?.users?.find((u: any) => u.id === idB);
    assert.ok(bInFollowing2);
    assert.equal(bInFollowing2.username, userB.username);
    const expectedProfileHrefB = `/u/${userB.username}`;
    console.log(`   -> User B in Account A's Following list is now clickable: ${expectedProfileHrefB}`);

    const followersResB = await api(`/api/social/followers?userId=${idB}`, { cookie: cookieB });
    assert.equal(followersResB.status, 200);
    const aInFollowersB = followersResB.data?.users?.find((u: any) => u.id === idA);
    assert.ok(aInFollowersB);
    assert.equal(aInFollowersB.username, userA.username);
    const expectedProfileHrefA = `/u/${userA.username}`;
    console.log(`   -> User A in Account B's Followers list is clickable: ${expectedProfileHrefA}`);

    // ----------------------------------------------------
    // Step 11: Open public profiles
    // ----------------------------------------------------
    console.log(`\n11. Opening public profiles...`);
    const profilePageResB = await api(`/u/${userB.username}`);
    assert.equal(profilePageResB.status, 200, "Public profile for User B must return HTTP 200");
    assert(
      typeof profilePageResB.data === "string" && profilePageResB.data.includes(userB.username),
      "Public profile page must contain user's username"
    );
    assert(
      typeof profilePageResB.data === "string" && profilePageResB.data.includes(userB.name),
      "Public profile page must contain user's display name"
    );

    const profilePageResA = await api(`/u/${userA.username}`);
    assert.equal(profilePageResA.status, 200, "Public profile for User A must return HTTP 200");
    assert(
      typeof profilePageResA.data === "string" && profilePageResA.data.includes(userA.username),
      "Public profile page must contain user's username"
    );
    console.log(`   -> Public profiles /u/${userA.username} and /u/${userB.username} resolved and rendered successfully`);

    console.log("\n=======================================================");
    console.log("ALL ONBOARDING & SOCIAL E2E CHECKS PASSED SUCCESSFULLY!");
    console.log("=======================================================\n");
  } finally {
    // ----------------------------------------------------
    // Guaranteed Cleanup: Runs unconditionally on pass or fail
    // ----------------------------------------------------
    console.log("Cleaning up test accounts and relationships...");
    try {
      const foundUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.email, emails))
        .catch(() => []);

      const allTargetIds = Array.from(new Set([...createdUserIds, ...foundUsers.map((u) => u.id)]));

      if (allTargetIds.length > 0) {
        await db.delete(notifications).where(
          sql`${notifications.recipientUserId} IN ${allTargetIds} OR ${notifications.actorUserId} IN ${allTargetIds}`
        );
        await db.delete(follows).where(
          sql`${follows.followerId} IN ${allTargetIds} OR ${follows.followingId} IN ${allTargetIds}`
        );
        await db.delete(feedActivities).where(inArray(feedActivities.userId, allTargetIds));
        await db.delete(session).where(inArray(session.userId, allTargetIds));
        await db.delete(account).where(inArray(account.userId, allTargetIds));
        await db.delete(user).where(inArray(user.id, allTargetIds));
      }
      console.log(`Cleaned up ${allTargetIds.length} test accounts and all associated records.`);
    } catch (cleanupError) {
      console.error("Error during test cleanup:", cleanupError);
    } finally {
      await pool.end();
    }
  }
})().catch((err) => {
  console.error("\nE2E VERIFICATION FAILED:", err);
  process.exitCode = 1;
});
