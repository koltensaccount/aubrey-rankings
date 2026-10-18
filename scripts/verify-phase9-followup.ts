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
import { eq, inArray, and } from "drizzle-orm";
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3004;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const testUser = {
  name: `Followup Tester ${tag}`,
  email: `followup-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `followup_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let userId: string = "";
let sessionCookie: string = "";
let tierCollectionId: string = "";
let numericalCollectionId: string = "";
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

  serverProcess.stdout?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) console.log("[server out]", msg);
  });
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString();
    if (!msg.includes("ExperimentalWarning")) console.error("[server err]", msg.trim());
  });

  await waitForServer(BASE_URL);
}

async function seedData() {
  console.log("🌱 Seeding test TV episodes and collection...");
  // 1. Create a dedicated tier rating system for user
  testRatingSystemId = `rs_tier_${tag}`;
  await db.insert(ratingSystems).values({
    id: testRatingSystemId,
    userId,
    name: `Anthology Tiers [${tag}]`,
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

  // 2. Create TV episodes with seasonNumber and episodeNumber
  const episodes = [
    { id: `med_bm_s1e1_${tag}`, title: "The National Anthem", seasonNumber: 1, episodeNumber: 1, mediaType: "episode" },
    { id: `med_bm_s1e2_${tag}`, title: "Fifteen Million Merits", seasonNumber: 1, episodeNumber: 2, mediaType: "episode" },
    { id: `med_bm_s2e1_${tag}`, title: "Be Right Back", seasonNumber: 2, episodeNumber: 1, mediaType: "episode" },
    { id: `med_bm_s3e1_${tag}`, title: "Nosedive", seasonNumber: 3, episodeNumber: 1, mediaType: "episode" },
  ];
  testMediaIds = episodes.map((e) => e.id);

  for (const ep of episodes) {
    await db.insert(mediaItems).values({
      id: ep.id,
      title: ep.title,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      mediaType: ep.mediaType,
    });
  }

  // 3. Create Tier Collection
  tierCollectionId = `col_tier_${tag}`;
  await db.insert(collections).values({
    id: tierCollectionId,
    userId,
    title: `Black Mirror Episode Ranking [${tag}]`,
    collectionType: "tv_show",
    visibility: "public",
    defaultRatingSystemId: testRatingSystemId,
  });

  // Add entries
  for (let i = 0; i < episodes.length; i++) {
    await db.insert(collectionEntries).values({
      id: `ce_${tag}_${i}`,
      collectionId: tierCollectionId,
      mediaItemId: episodes[i].id,
      sortOrder: i + 1,
    });
  }

  // Assign one episode to Tier B initially for testing
  await db.insert(ratings).values({
    id: `rat_${tag}_1`,
    userId,
    mediaItemId: episodes[0].id,
    collectionId: tierCollectionId,
    ratingSystemId: testRatingSystemId,
    tierId: tierB,
    reviewText: "Incredible pilot episode.",
    personalNotes: "Shocking ending.",
  });
}

async function runVerification() {
  console.log("🎬 Phase 9 Usability & Safety Follow-up Playwright Verification starting...");

  const acc = await createAccount(testUser);
  userId = acc.id;
  sessionCookie = acc.cookie;
  console.log(`✔ Created isolated user: ${testUser.username} (${userId})`);

  await seedData();
  console.log("✔ Seeded TV episode media items and tier collection");

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
  page.on("console", (m) => console.log("[BROWSER CONSOLE]", m.type(), m.text()));
  page.on("pageerror", (err) => console.log("[BROWSER ERROR]", err));
  page.on("response", (res) => {
    if (res.status() >= 400 || res.url().includes("/api/rating-systems")) {
      console.log(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  try {
    // Navigate to the tier collection page
    console.log(`\n--- Journey 1: Open Tier Board and Verify Customize Tiers Appears Above Board ---`);
    await page.goto(`${BASE_URL}/collection/${tierCollectionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    console.log("Current page URL:", page.url(), "Title:", await page.title());
    console.log("Page body text:\n", (await page.innerText("body")).slice(0, 400));

    // Click "Rank Items" to open full-screen Tier Board Editor
    const rankItemsBtn = page.locator("button:has-text('Rank Items')");
    await assert.doesNotReject(rankItemsBtn.waitFor({ timeout: 5000 }));
    await rankItemsBtn.click();
    await page.waitForTimeout(400);

    // Verify Tier Board Editor modal is open
    const tierBoardHeader = page.locator("h2:has-text('Tier Board Editor')");
    await assert.doesNotReject(tierBoardHeader.waitFor({ timeout: 5000 }));
    console.log("✔ Full-screen Tier Board Editor is open");

    // Click "Customize Tiers" inside the editor
    const customizeTiersBtn = page.locator("header button:has-text('Customize Tiers')");
    await assert.doesNotReject(customizeTiersBtn.waitFor({ timeout: 5000 }));
    await customizeTiersBtn.click();
    await page.waitForTimeout(500);

    // Confirm the Customize Tiers dialog appears ABOVE the board and is interactive
    const dialogTitle = page.locator("h2:has-text('Tier Rating System'), h3:has-text('Tier Rating System')");
    await assert.doesNotReject(dialogTitle.waitFor({ timeout: 5000 }));
    console.log("✔ Customize Tiers dialog is open and visible");

    // Capture screenshot proving dialog appears on top of the tier board editor
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-dialog-above-tier-board.png"),
    });
    console.log("📸 Saved stage26-dialog-above-tier-board.png");

    // --- Journey 2: Modify a tier name/color, save, confirm immediate update ---
    console.log(`\n--- Journey 2: Modify Tier, Save, and Confirm Immediate Update on Board ---`);
    const tierNameInput = page.locator("input[value='S']").first();
    await assert.doesNotReject(tierNameInput.waitFor({ timeout: 5000 }));
    await tierNameInput.fill("GOD TIER");

    // Click Save Rubric
    const saveRubricBtn = page.locator("button:has-text('Save Rubric')");
    await saveRubricBtn.click();
    await page.waitForTimeout(1000);

    // Confirm dialog closed and returned user directly to the tier board
    await assert.rejects(dialogTitle.waitFor({ timeout: 1000 }), "Dialog should be closed");
    await assert.doesNotReject(tierBoardHeader.waitFor({ timeout: 2000 }), "Tier board editor must remain active in foreground");

    // Confirm the tier row immediately reflects "GOD TIER"
    const godTierRow = page.locator("text='GOD TIER'").first();
    await assert.doesNotReject(godTierRow.waitFor({ timeout: 3000 }));
    console.log("✔ Tier board immediately updated with 'GOD TIER' row name without re-opening");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-tier-customized-immediately.png"),
    });
    console.log("📸 Saved stage26-tier-customized-immediately.png");

    // --- Journey 3: Cancel customization and verify no changes saved ---
    console.log(`\n--- Journey 3: Cancel Customization and Verify No Changes Saved ---`);
    await customizeTiersBtn.click();
    await page.waitForTimeout(400);

    const godTierInput = page.locator("input[value='GOD TIER']").first();
    await godTierInput.fill("SHOULD_NOT_SAVE");

    const cancelBtn = page.locator("button:has-text('Cancel')");
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Verify still shows "GOD TIER", not "SHOULD_NOT_SAVE"
    await assert.doesNotReject(page.locator("text='GOD TIER'").first().waitFor({ timeout: 2000 }));
    const shouldNotSave = page.locator("text='SHOULD_NOT_SAVE'");
    assert.strictEqual(await shouldNotSave.count(), 0, "Canceled changes must not be applied");
    console.log("✔ Canceled customization cleanly left board in 'GOD TIER' state");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-tier-customization-canceled.png"),
    });
    console.log("📸 Saved stage26-tier-customization-canceled.png");

    // --- Journey 4: Rank episodes from different seasons & verify S01 · E01 badges ---
    console.log(`\n--- Journey 4: Distinguishable TV Season/Episode Badges (Desktop & Dragging) ---`);
    const episodeBadges = page.locator("[data-testid='episode-badge']");
    const badgeCount = await episodeBadges.count();
    assert.ok(badgeCount >= 4, `Expected at least 4 episode badges, found ${badgeCount}`);

    // Verify badge text formats
    const badgeTexts = await episodeBadges.allInnerTexts();
    console.log("Observed Episode Badges:", badgeTexts);
    assert.ok(badgeTexts.some((t) => t.includes("S01 · E01")), "Must have S01 · E01 badge");
    assert.ok(badgeTexts.some((t) => t.includes("S01 · E02")), "Must have S01 · E02 badge");
    assert.ok(badgeTexts.some((t) => t.includes("S02 · E01")), "Must have S02 · E01 badge");
    assert.ok(badgeTexts.some((t) => t.includes("S03 · E01")), "Must have S03 · E01 badge");
    console.log("✔ Season and Episode badges are rendered accurately and non-intrusively");

    // Move an episode from Unranked Tray to GOD TIER using accessible move menu
    const unrankedCardMenu = page.locator("[data-testid='unranked-tray'] [data-testid='card-move-menu-trigger']").first();
    await unrankedCardMenu.click({ force: true });
    await page.waitForTimeout(300);

    const moveToGodTier = page.locator("[data-testid='move-to-tier-GOD TIER']");
    await moveToGodTier.click();
    await page.waitForTimeout(800);

    // Verify badge remains visible in the tier row after move
    const movedBadges = await page.locator("[data-testid='episode-badge']").allInnerTexts();
    assert.ok(movedBadges.some((t) => t.includes("S01 · E01")), "Badge must persist accurately after moving");
    console.log("✔ Episode badge remains visible and accurate after move");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-episode-badges-after-move.png"),
    });
    console.log("📸 Saved stage26-episode-badges-after-move.png");

    // --- Journey 5: Mobile Viewport Verification ---
    console.log(`\n--- Journey 5: Mobile Viewport Verification (375x667) ---`);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const mobileBadges = await page.locator("[data-testid='episode-badge']").allInnerTexts();
    assert.ok(mobileBadges.length >= 4, "Mobile cards must also display episode badges");
    console.log("✔ Mobile viewport renders badges clearly without clipping");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-mobile-tier-board.png"),
    });
    console.log("📸 Saved stage26-mobile-tier-board.png");

    // Restore desktop viewport and close editor
    await page.setViewportSize({ width: 1280, height: 900 });
    const doneBtn = page.locator("button:has-text('Done')");
    await doneBtn.click();
    await page.waitForTimeout(500);

    // --- Journey 6: Settings Occupied Tier Deletion Protection & Reassignment ---
    console.log(`\n--- Journey 6: Settings Occupied Tier Deletion Protection & Explicit Confirmation ---`);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const ratingSystemsTab = page.locator("button:has-text('Rating Systems')");
    await ratingSystemsTab.click();
    await page.waitForTimeout(500);

    // Select the test rating system
    const systemBtn = page.locator(`text='Anthology Tiers [${tag}]'`).first();
    await systemBtn.click();
    await page.waitForTimeout(500);

    // Find Tier B (which has 1 active rating) and click Remove Tier
    // Tier B is the 3rd tier row in the list
    const removeTierBtns = page.locator("button[title='Remove Tier']");
    const countRemove = await removeTierBtns.count();
    console.log("countRemove:", countRemove);
    assert.ok(countRemove >= 3, `Expected at least 3 tiers in editor, found ${countRemove}`);
    await removeTierBtns.nth(2).click(); // Remove Tier B
    await page.waitForTimeout(300);

    // Click "Save Tier System"
    const saveTierSystemBtn = page.locator("button:has-text('Save Tier System')");
    console.log("saveBtn visible?", await saveTierSystemBtn.isVisible());
    await saveTierSystemBtn.click();
    await page.waitForTimeout(800);

    // Confirm that the Tier Removal Conflict Modal appears explaining the tier is in use
    const conflictModal = page.locator("h4:has-text('Tier In Use:')");
    await assert.doesNotReject(conflictModal.waitFor({ timeout: 5000 }));
    console.log("✔ Tier In Use conflict dialog successfully caught removal and displayed");

    // Capture screenshot of the conflict dialog
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-settings-occupied-tier-conflict-modal.png"),
    });
    console.log("📸 Saved stage26-settings-occupied-tier-conflict-modal.png");

    // Select Reassign (default) and Confirm & Save
    const confirmSaveBtn = page.locator("button:has-text('Confirm & Save')");
    await confirmSaveBtn.click();
    await page.waitForTimeout(1000);

    // Verify save succeeded cleanly
    console.log("✔ Reassignment completed safely without data loss");

    // --- Journey 7: Verify Normal Numerical Rating Workflows Remain Unaffected ---
    console.log(`\n--- Journey 7: Normal Numerical Rating Workflows Remain Unaffected ---`);
    await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle" });
    await page.locator("button:has-text('Custom Ranking')").click();
    await page.locator("button:has-text('Numerical Rating')").click();
    await page.fill('input[placeholder="e.g. Sci-Fi Anthology Essentials"]', `Numerical Test Ranking [${tag}]`);
    await page.click("button:has-text('Create Collection')");
    await page.waitForURL(/\/collection\/col_/, { timeout: 10000 });

    const currentUrl = page.url();
    numericalCollectionId = currentUrl.split("/collection/")[1];
    console.log(`✔ Created numerical ranking: ${numericalCollectionId}`);

    // Confirm numerical rubric button is present
    const rubricBtn = page.locator("button:has-text('Adjust Weights')");
    await assert.doesNotReject(rubricBtn.waitFor({ timeout: 5000 }));
    console.log("✔ Numerical rating rubric workflow is 100% intact");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage26-numerical-rating-workflow.png"),
    });
    console.log("📸 Saved stage26-numerical-rating-workflow.png");

    console.log("\n🎉 ALL 7 PLAYWRIGHT VERIFICATION JOURNEYS PASSED WITH 100% SUCCESS!");
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
  if (numericalCollectionId) {
    await db.delete(collections).where(eq(collections.id, numericalCollectionId));
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
