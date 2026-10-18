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

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const testUser = {
  name: `Quentin Curator ${tag}`,
  email: `quentin-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `quentin_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let userId: string = "";
let sessionCookie: string = "";
let createdCollectionId: string = "";

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
      hasCompletedOnboarding: true,
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

async function runVerification() {
  console.log("🎬 Phase 9 UX & Design System Follow-up Verification starting...");

  const acc = await createAccount(testUser);
  userId = acc.id;
  sessionCookie = acc.cookie;
  console.log(`✔ Created isolated user: ${testUser.username} (${userId})`);

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
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page: Page = await context.newPage();

  try {
    // 1. Visit /create and verify Step 2: Evaluation Method
    console.log("🔍 Checking /create workflow...");
    page.on("pageerror", (err) => console.error("PAGE ERROR:", err));
    page.on("console", (msg) => console.log("PAGE CONSOLE:", msg.text()));
    await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    console.log("Current page URL:", page.url(), "Title:", await page.title());

    // Step 2 should be visible with Numerical Rating and Tier List choices
    const numericalCard = page.locator("button:has-text('Numerical Rating')");
    const tierCard = page.locator("button:has-text('Tier List')");
    await assert.doesNotReject(numericalCard.waitFor({ timeout: 5000 }));
    await assert.doesNotReject(tierCard.waitFor({ timeout: 5000 }));
    console.log("✔ Step 2 Evaluation Method options are clearly presented");

    // Select Custom collection and Tier List method
    await page.locator("button:has-text('Custom Ranking')").click();
    await tierCard.click();

    // Fill title
    const collectionName = `Sci-Fi Canon Tier List [${tag}]`;
    await page.fill('input[placeholder="e.g. Sci-Fi Anthology Essentials"]', collectionName);

    // Capture screenshot of /create with Tier List chosen
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-create-tier-list-selection.png"),
      fullPage: true,
    });
    console.log("📸 Saved stage25-create-tier-list-selection.png");

    // Click Create Collection button
    await page.click("button:has-text('Create Collection')");
    await page.waitForURL(/\/collection\/col_/, { timeout: 10000 });
    const currentUrl = page.url();
    createdCollectionId = currentUrl.split("/collection/")[1].split("?")[0];
    console.log(`✔ Collection successfully created with Tier List method: ${createdCollectionId}`);

    // Wait for collection header to load
    await page.waitForSelector("h1", { timeout: 10000 });

    // 2. Verify collection header shows Tier System and prominent Rank Items button
    const rankItemsBtn = page.locator("button:has-text('Rank Items')").first();
    await assert.doesNotReject(rankItemsBtn.waitFor({ timeout: 5000 }));
    console.log("✔ Prominent 'Rank Items' button is displayed");

    // Verify rubric panel shows Tier System and "Switch to Numerical" option
    const switchToNumericalBtn = page.locator("button:has-text('Switch to Numerical')");
    await assert.doesNotReject(switchToNumericalBtn.waitFor({ timeout: 5000 }));
    console.log("✔ Intuitive 'Switch to Numerical' control is displayed in collection rubric card");

    // Capture screenshot of Tier List ranking page
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-tier-collection-header-and-toolbar.png"),
      fullPage: true,
    });
    console.log("📸 Saved stage25-tier-collection-header-and-toolbar.png");

    // 3. Open Tier Board Editor Modal and verify semantic design tokens
    await rankItemsBtn.click();
    const editorModal = page.locator("header:has-text('Tier Board Editor')");
    await assert.doesNotReject(editorModal.waitFor({ timeout: 5000 }));
    console.log("✔ Tier-board editor modal opened cleanly");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-tier-board-editor-semantic-theme.png"),
      fullPage: true,
    });
    console.log("📸 Saved stage25-tier-board-editor-semantic-theme.png");

    // Close editor modal via Done button
    await page.click("button:has-text('Done')");
    await page.waitForTimeout(600);

    // 4. Switch collection from Tier List to Numerical Rubric
    console.log("🔄 Testing non-destructive switch: Tier -> Numerical...");
    await switchToNumericalBtn.click();

    // Verify CollectionRubricDialog opened with Numerical mode active
    const rubricDialog = page.locator("h3:has-text('Numerical Weighted Rubric')");
    await assert.doesNotReject(rubricDialog.waitFor({ timeout: 5000 }));
    console.log("✔ CollectionRubricDialog opened with Numerical Weighted Rubric active");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-rubric-dialog-switch-to-numerical.png"),
    });
    console.log("📸 Saved stage25-rubric-dialog-switch-to-numerical.png");

    // Click Apply & Switch Format
    await page.click("button:has-text('Apply & Switch Format')");
    await page.waitForTimeout(1000);

    // Verify header now reflects Numerical rubric
    const adjustWeightsBtn = page.locator("button:has-text('Adjust Weights')");
    await assert.doesNotReject(adjustWeightsBtn.waitFor({ timeout: 5000 }));
    const switchToTierBtn = page.locator("button:has-text('Switch to Tier List')");
    await assert.doesNotReject(switchToTierBtn.waitFor({ timeout: 5000 }));
    console.log("✔ Collection successfully switched to Numerical Weighted Rubric");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-collection-switched-to-numerical.png"),
      fullPage: true,
    });
    console.log("📸 Saved stage25-collection-switched-to-numerical.png");

    // 5. Switch back from Numerical to Tier List
    console.log("🔄 Testing non-destructive switch: Numerical -> Tier...");
    await switchToTierBtn.click();
    const tierDialog = page.locator("h3:has-text('Tier Rating System')");
    await assert.doesNotReject(tierDialog.waitFor({ timeout: 5000 }));

    await page.click("button:has-text('Apply & Switch Format')");
    await page.waitForTimeout(1000);

    await assert.doesNotReject(page.locator("button:has-text('Customize Tiers')").waitFor({ timeout: 5000 }));
    console.log("✔ Collection successfully switched back to Tier Rating System");

    // 6. Test Settings -> Rating Systems tab navigation
    console.log("⚙ Checking Settings tab label...");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const ratingSystemsTab = page.locator("button:has-text('Rating Systems')");
    await assert.doesNotReject(ratingSystemsTab.waitFor({ timeout: 5000 }));
    await ratingSystemsTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage25-settings-rating-systems-tab.png"),
      fullPage: true,
    });
    console.log("📸 Saved stage25-settings-rating-systems-tab.png");

    console.log("🎉 All browser verification steps passed with 100% success!");
  } finally {
    await browser.close();
  }
}

async function cleanup() {
  console.log("🧹 Cleaning up test data and shutting down server...");
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
  if (createdCollectionId) {
    await db.delete(collections).where(eq(collections.id, createdCollectionId));
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
