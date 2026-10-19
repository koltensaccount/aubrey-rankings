import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { db, pool } from "../src/db";
import {
  user,
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  ratingSystems,
  ratingTiers,
} from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3004;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const testUser = {
  name: `View Persistence Tester ${tag}`,
  email: `viewtest-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `viewtest_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let userId: string = "";
let sessionCookie: string = "";
let tierCollectionId: string = "";
let testMediaIds: string[] = [];
let testRatingSystemId: string = "";

async function createAccount(data: typeof testUser) {
  const res = await auth.api.signUpEmail({
    body: {
      email: data.email,
      password: data.password,
      name: data.name,
    },
    asResponse: true,
  });
  assert.equal(res.status, 200, `Sign up for ${data.email} failed`);
  const rawCookie = res.headers.get("set-cookie") || "";
  const match = rawCookie.match(/better-auth\.session_token=([^;]+)/);
  const cookieVal = match ? match[1] : "";

  const u = await db.query.user.findFirst({
    where: eq(user.email, data.email),
  });
  assert.ok(u, "User record not found");

  await db
    .update(user)
    .set({
      username: data.username,
      emailVerified: true,
    })
    .where(eq(user.id, u.id));

  return { id: u.id, cookie: cookieVal };
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function startServer(): Promise<void> {
  console.log(`🚀 Starting test Next.js server on port ${PORT}...`);
  serverProcess = spawn("node", ["--env-file=.env.local", ".next/standalone/server.js"], {
    cwd: "/Users/koltenbendickson/Projects/aubrey-rankings",
    stdio: "pipe",
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost" },
  });

  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    if (!msg.includes("ExperimentalWarning")) console.error("[server err]", msg.trim());
  });

  await waitForServer(BASE_URL);
}

async function seedData() {
  console.log("🌱 Seeding test franchise movies and tier collection...");
  testRatingSystemId = `rs_tier_persist_${tag}`;
  await db.insert(ratingSystems).values({
    id: testRatingSystemId,
    userId,
    name: `Franchise Tiers [${tag}]`,
    type: "tier",
    scale: 10,
    isDefault: false,
  });

  const tierS = `tier_s_${tag}`;
  const tierA = `tier_a_${tag}`;
  const tierB = `tier_b_${tag}`;
  await db.insert(ratingTiers).values([
    { id: tierS, ratingSystemId: testRatingSystemId, name: "S", description: "Masterpiece", color: "#EF4444", sortOrder: 1 },
    { id: tierA, ratingSystemId: testRatingSystemId, name: "A", description: "Great", color: "#F97316", sortOrder: 2 },
    { id: tierB, ratingSystemId: testRatingSystemId, name: "B", description: "Good", color: "#F59E0B", sortOrder: 3 },
  ]);

  const movies = [
    { id: `med_lep_1_${tag}`, title: "Leprechaun (1993)", mediaType: "movie" },
    { id: `med_lep_2_${tag}`, title: "Leprechaun 2 (1994)", mediaType: "movie" },
    { id: `med_lep_3_${tag}`, title: "Leprechaun 3 (1995)", mediaType: "movie" },
  ];
  testMediaIds = movies.map((m) => m.id);

  for (const m of movies) {
    await db.insert(mediaItems).values({
      id: m.id,
      title: m.title,
      mediaType: m.mediaType,
    });
  }

  tierCollectionId = `col_tier_persist_${tag}`;
  await db.insert(collections).values({
    id: tierCollectionId,
    userId,
    title: `Leprechaun Collection [${tag}]`,
    collectionType: "movie_franchise",
    visibility: "public",
    defaultRatingSystemId: testRatingSystemId,
  });

  for (let i = 0; i < movies.length; i++) {
    await db.insert(collectionEntries).values({
      id: `ce_${tag}_${i}`,
      collectionId: tierCollectionId,
      mediaItemId: movies[i].id,
      sortOrder: i + 1,
    });
  }

  // Assign one movie to tier S
  await db.insert(ratings).values({
    id: `rat_${tag}_1`,
    userId,
    mediaItemId: movies[0].id,
    collectionId: tierCollectionId,
    ratingSystemId: testRatingSystemId,
    tierId: tierS,
    reviewText: "Classic horror comedy.",
  });
}

async function runVerification() {
  console.log("🎬 Verifying Tier List Default View & Exit View Persistence...");

  const acc = await createAccount(testUser);
  userId = acc.id;
  sessionCookie = acc.cookie;
  console.log(`✔ Created isolated user: ${testUser.username}`);

  await seedData();
  console.log("✔ Seeded test tier collection and items");

  await startServer();
  console.log(`✔ Next.js test server active at ${BASE_URL}`);

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: sessionCookie,
      url: BASE_URL,
    },
  ]);

  const page: Page = await context.newPage();

  try {
    // 1. Initial Open: Must default to Tier Board view
    console.log("\n--- Test 1: Opening tier collection defaults to tier_board view ---");
    await page.goto(`${BASE_URL}/collection/${tierCollectionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    console.log("Page body (from 400):\n", (await page.innerText("body")).slice(400, 1500));

    // Verify Tier Board elements are visible by default
    const tierBoardBanner = page.locator("h3:has-text('Interactive Tier-Board Editor')");
    await assert.doesNotReject(tierBoardBanner.waitFor({ timeout: 5000 }));
    const tierRowS = page.locator("text='Masterpiece'").first();
    await assert.doesNotReject(tierRowS.waitFor({ timeout: 5000 }));
    console.log("✔ Tier List mode correctly defaults to Tier Board view upon initial opening");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage27-tier-view-default.png"),
    });
    console.log("📸 Saved stage27-tier-view-default.png");

    // 2. Switch to List View
    console.log("\n--- Test 2: User switches view to List view ---");
    const listViewBtn = page.locator("button[title='List view']");
    await listViewBtn.click();
    await page.waitForTimeout(500);

    // Verify tier board banner is gone and list rows are visible
    assert.strictEqual(await tierBoardBanner.count(), 0);
    const movieRow = page.locator("text='Leprechaun (1993)'").first();
    await assert.doesNotReject(movieRow.waitFor({ timeout: 3000 }));
    console.log("✔ Switched to List view");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage27-switched-to-list-view.png"),
    });
    console.log("📸 Saved stage27-switched-to-list-view.png");

    // 3. Reload Page: Must restore user's last exit view (List view)
    console.log("\n--- Test 3: Refreshing page restores saved List view ---");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    assert.strictEqual(await tierBoardBanner.count(), 0, "Tier board banner must NOT be visible when user exited on list view");
    await assert.doesNotReject(movieRow.waitFor({ timeout: 3000 }), "List view movie rows must be visible");
    console.log("✔ Saved exit view (List view) successfully restored upon reopening collection");

    // 4. Switch to Grid View (Editorial)
    console.log("\n--- Test 4: User switches to Grid view and reloads ---");
    const gridViewBtn = page.locator("button[title='Grid view']");
    await gridViewBtn.click();
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    assert.strictEqual(await tierBoardBanner.count(), 0);
    // Grid view has active grid button
    const activeGridBtn = page.locator("button[title='Grid view'].text-primary-text");
    await assert.doesNotReject(activeGridBtn.waitFor({ timeout: 3000 }));
    console.log("✔ Saved exit view (Grid view) successfully restored upon reopening collection");

    // 5. Switch back to Tier Board view
    console.log("\n--- Test 5: Switch back to Tier Board and verify persistence ---");
    const tierBoardBtn = page.locator("button[title='Tier Board view']");
    await tierBoardBtn.click();
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    await assert.doesNotReject(tierBoardBanner.waitFor({ timeout: 5000 }));
    console.log("✔ Saved exit view (Tier Board view) successfully restored upon reopening collection");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage27-tier-view-restored-after-reload.png"),
    });
    console.log("📸 Saved stage27-tier-view-restored-after-reload.png");

    // 6. Switch to Numerical Rubric format
    console.log("\n--- Test 6: Switch format to Numerical Rubric defaults to List view ---");
    const switchToNumericalBtn = page.locator("button:has-text('Switch to Numerical')");
    await switchToNumericalBtn.click();
    await page.waitForTimeout(500);

    const applySwitchBtn = page.locator("button:has-text('Apply & Switch Format')");
    await applySwitchBtn.click();
    await page.waitForTimeout(1200);

    // Confirm that on switching to numerical, view switches to list view
    assert.strictEqual(await tierBoardBanner.count(), 0);
    await assert.doesNotReject(movieRow.waitFor({ timeout: 3000 }));
    console.log("✔ Switching format to numerical correctly defaults to List view");

    // 7. Switch back to Tier List format
    console.log("\n--- Test 7: Switch format back to Tier List defaults to Tier Board view ---");
    const switchToTierBtn = page.locator("button:has-text('Switch to Tier List')");
    await switchToTierBtn.click();
    await page.waitForTimeout(500);

    const applyTierSwitchBtn = page.locator("button:has-text('Apply & Switch Format')");
    await applyTierSwitchBtn.click();
    await page.waitForTimeout(1200);

    // Confirm that on switching back to tier list, view defaults to Tier Board view
    await assert.doesNotReject(tierBoardBanner.waitFor({ timeout: 5000 }));
    console.log("✔ Switching format back to Tier List correctly defaults to Tier Board view");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage27-switched-back-to-tier-board.png"),
    });
    console.log("📸 Saved stage27-switched-back-to-tier-board.png");

    console.log("\n🎉 ALL TIER VIEW PERSISTENCE TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    await browser.close();
  }
}

async function cleanup() {
  console.log("🧹 Cleaning up test data and shutting down test server...");
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
  if (tierCollectionId) {
    await db.delete(collections).where(eq(collections.id, tierCollectionId));
  }
  if (testMediaIds.length > 0) {
    await db.delete(mediaItems).where(inArray(mediaItems.id, testMediaIds));
  }
  if (userId) {
    await db.delete(user).where(eq(user.id, userId));
  }
  await pool.end();
}

runVerification()
  .then(() => cleanup())
  .catch(async (err) => {
    console.error("❌ Verification failed:", err);
    await cleanup();
    process.exit(1);
  });
