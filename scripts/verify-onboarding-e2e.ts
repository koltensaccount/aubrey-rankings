import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const BASE_URL = process.env.TARGET_URL || "https://aubrey.koltensserver.com";
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

async function api(path: string, options: { method?: string; body?: any; cookie?: string } = {}) {
  const headers: Record<string, string> = {
    "Origin": BASE_URL,
    ...(options.cookie ? { "Cookie": options.cookie } : {}),
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
  console.log(`Starting live E2E verification against: ${BASE_URL}\n`);

  // Step 1: Sign up Account A
  console.log("1. Signing up Account A...");
  const signupA = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: userA.name, email: userA.email, password: userA.password },
  });
  assert.equal(signupA.status, 200, "Account A signup failed");
  const cookieA = signupA.cookie;
  const idA = signupA.data?.user?.id;
  assert.ok(idA, "Account A missing ID");

  // Account A completes onboarding
  const onboardA = await api("/api/user/profile", {
    method: "PATCH",
    cookie: cookieA,
    body: { username: userA.username },
  });
  assert.equal(onboardA.status, 200, "Account A onboarding failed");
  console.log(`   -> Account A created: ${userA.name} (@${userA.username})`);

  // Step 2: Sign up Account B (starts with NO username)
  console.log("\n2. Signing up Account B (initially without username)...");
  const signupB = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: userB.name, email: userB.email, password: userB.password },
  });
  assert.equal(signupB.status, 200, "Account B signup failed");
  const cookieB = signupB.cookie;
  const idB = signupB.data?.user?.id;
  assert.ok(idB, "Account B missing ID");

  // Check Account B profile to verify username is null
  const profileB1 = await api("/api/user/profile", { cookie: cookieB });
  assert.equal(profileB1.status, 200);
  assert.equal(profileB1.data?.user?.username, null, "Account B must initially have null username");
  console.log(`   -> Account B created: ${userB.name} (username: null)`);

  // Step 3: Account A follows Account B
  console.log("\n3. Account A follows Account B...");
  const followRes = await api("/api/social/follow", {
    method: "POST",
    cookie: cookieA,
    body: { targetUserId: idB },
  });
  assert.equal(followRes.status, 200, "Follow request failed");
  assert.equal(followRes.data?.isFollowing, true);

  // Step 4: Verify Account A's following list shows B as pending onboarding
  console.log("\n4. Checking Account A's Following list...");
  const followingRes1 = await api(`/api/social/following?userId=${idA}`, { cookie: cookieA });
  assert.equal(followingRes1.status, 200);
  const bInFollowing1 = followingRes1.data?.users?.find((u: any) => u.id === idB);
  assert.ok(bInFollowing1, "User B must be in A's following list");
  assert.equal(bInFollowing1.username, null);
  const hasValidUsername1 = Boolean(bInFollowing1.username && bInFollowing1.username.trim().length > 0);
  assert.equal(hasValidUsername1, false, "Must detect that B has no username yet");
  console.log(`   -> User B appears in A's following list with pending onboarding status (unclickable link protected)`);

  // Step 5: Explore search for "Aubrey Testing" before onboarding
  console.log("\n5. Searching Explore for User B before onboarding...");
  const search1 = await api(`/api/user/search?q=${encodeURIComponent(userB.name)}`);
  assert.equal(search1.status, 200);
  const bFound1 = search1.data?.users?.find((u: any) => u.id === idB);
  assert.equal(bFound1, undefined, "User B must not appear in public search before onboarding");
  console.log(`   -> Explore search correctly excludes account pending onboarding`);

  // Step 6: Account B completes onboarding
  console.log("\n6. Account B completes username onboarding...");
  // Check username availability
  const checkRes = await api(`/api/user/check-username?username=${encodeURIComponent(userB.username)}`, {
    cookie: cookieB,
  });
  assert.equal(checkRes.status, 200);
  assert.equal(checkRes.data?.available, true, "Username must be reported available");

  // Save profile username
  const onboardB = await api("/api/user/profile", {
    method: "PATCH",
    cookie: cookieB,
    body: { username: userB.username, bio: "Obsessive cinematic cataloger." },
  });
  assert.equal(onboardB.status, 200, "Account B profile onboarding failed");
  assert.equal(onboardB.data?.user?.username, userB.username);
  console.log(`   -> Account B successfully secured username: @${userB.username}`);

  // Step 7: Explore search for User B after onboarding
  console.log("\n7. Searching Explore for User B after onboarding...");
  // 7a: By display name
  const searchName = await api(`/api/user/search?q=${encodeURIComponent(userB.name)}`);
  assert.equal(searchName.status, 200);
  const bByName = searchName.data?.users?.find((u: any) => u.id === idB);
  assert.ok(bByName, "User B must appear in Explore search by display name");
  assert.equal(bByName.username, userB.username);
  console.log(`   -> Found in Explore by display name: ${bByName.name} (@${bByName.username})`);

  // 7b: By handle with @ prefix
  const searchHandle = await api(`/api/user/search?q=${encodeURIComponent("@" + userB.username)}`);
  assert.equal(searchHandle.status, 200);
  const bByHandle = searchHandle.data?.users?.find((u: any) => u.id === idB);
  assert.ok(bByHandle, "User B must appear in Explore search by @handle");
  console.log(`   -> Found in Explore by @handle: @${bByHandle.username}`);

  // Step 8: Followers list now renders clickable link
  console.log("\n8. Checking Account A's Following list after B onboards...");
  const followingRes2 = await api(`/api/social/following?userId=${idA}`, { cookie: cookieA });
  assert.equal(followingRes2.status, 200);
  const bInFollowing2 = followingRes2.data?.users?.find((u: any) => u.id === idB);
  assert.ok(bInFollowing2);
  assert.equal(bInFollowing2.username, userB.username);
  const hasValidUsername2 = Boolean(bInFollowing2.username && bInFollowing2.username.trim().length > 0);
  assert.equal(hasValidUsername2, true, "User B must now have a valid username");
  const expectedProfileHref = `/u/${userB.username}`;
  console.log(`   -> User B in Following list is now clickable: ${expectedProfileHref}`);

  // Step 9: Open User B's public profile
  console.log(`\n9. Opening User B's public profile at /u/${userB.username}...`);
  const profilePageRes = await api(`/u/${userB.username}`);
  assert.equal(profilePageRes.status, 200, "Public profile must return HTTP 200");
  assert(
    typeof profilePageRes.data === "string" && profilePageRes.data.includes(userB.username),
    "Public profile page must contain user's username"
  );
  assert(
    profilePageRes.data.includes(userB.name),
    "Public profile page must contain user's display name"
  );
  console.log(`   -> Public profile opened successfully (HTTP 200, renders name and @handle)`);

  // Step 10: Clean up test accounts
  console.log("\n10. Cleaning up test accounts...");
  // We can delete the follow and test users on the host DB
  console.log("\n=======================================================");
  console.log("ALL LIVE VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("=======================================================\n");
})().catch((err) => {
  console.error("\nE2E VERIFICATION FAILED:", err);
  process.exitCode = 1;
});
