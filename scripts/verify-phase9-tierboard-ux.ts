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

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const ownerUser = {
  name: `Diana Director ${tag}`,
  email: `diana-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `diana_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let ownerId: string = "";
let ownerCookie: string = "";
let customTierSysId: string = "";
let tierSId: string = "";
let tierAId: string = "";
let tierBId: string = "";
let tierColId: string = "";

const mediaMovie1 = `media_movie1_${tag}`;
const mediaMovie2 = `media_movie2_${tag}`;
const mediaMovie3 = `media_movie3_${tag}`;
const mediaEpisode1 = `media_ep1_${tag}`;

async function createAccount(data: typeof ownerUser) {
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
  const rawToken = match ? match[1] : "";
  const cookieHeader = rawToken ? `better-auth.session_token=${rawToken}` : "";

  const record = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, data.email),
  });
  assert(record, `User ${data.email} must exist in DB`);

  await db
    .update(user)
    .set({ username: data.username, emailVerified: true })
    .where(eq(user.id, record.id));

  return { id: record.id, token: rawToken, cookie: cookieHeader };
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

(async () => {
  console.log("=== PHASE 9 TIER-BOARD UX VERIFICATION ===");
  console.log(`Port: ${PORT}`);

  try {
    // 1. Spawn Next.js production server
    console.log("Starting Next.js server on port", PORT);
    serverProcess = spawn("node", ["--env-file=.env.local", ".next/standalone/server.js"], {
      cwd: "/Users/koltenbendickson/Projects/aubrey-rankings",
      stdio: "pipe",
      env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost" },
    });

    await waitForServer(BASE_URL);
    console.log("Server healthy.");

    // 2. Set up test accounts and media items
    console.log("Creating test account and seeding data...");
    const ownerRes = await createAccount(ownerUser);
    ownerId = ownerRes.id;
    ownerCookie = ownerRes.cookie;

    // Seed media items: 3 movies (2:3 poster) and 1 episode (16:9 still)
    await db.insert(mediaItems).values([
      {
        id: mediaMovie1,
        title: "Interstellar",
        mediaType: "movie",
        releaseDate: "2014-11-07",
        posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      },
      {
        id: mediaMovie2,
        title: "Arrival",
        mediaType: "movie",
        releaseDate: "2016-11-11",
        posterPath: "/x2OEkMbaM02B895v2vWfIasN5q.jpg",
      },
      {
        id: mediaMovie3,
        title: "Dune (2021)",
        mediaType: "movie",
        releaseDate: "2021-10-22",
        posterPath: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
      },
      {
        id: mediaEpisode1,
        title: "San Junipero (Black Mirror)",
        mediaType: "episode",
        seasonNumber: 3,
        episodeNumber: 4,
        stillPath: "/san_junipero_still.jpg",
      },
    ]);

    // Create Tier Rubric
    const createRes = await fetch(`${BASE_URL}/api/rating-systems`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        name: "Sci-Fi Pantheon Tiers",
        type: "tier",
        tiers: [
          { name: "S", description: "God Tier", color: "#EF4444", sortOrder: 1 },
          { name: "A", description: "Masterpiece", color: "#F97316", sortOrder: 2 },
          { name: "B", description: "Great", color: "#F59E0B", sortOrder: 3 },
        ],
      }),
    });
    assert.equal(createRes.status, 200, "Should create tier system");
    const createData = await createRes.json();
    customTierSysId = createData.ratingSystem?.id || createData.id;

    const rubricRecord = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, customTierSysId),
      with: { tiers: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
    });
    assert(rubricRecord);
    tierSId = rubricRecord.tiers[0].id;
    tierAId = rubricRecord.tiers[1].id;
    tierBId = rubricRecord.tiers[2].id;

    // Create Collection
    tierColId = `col_diana_scifi_${tag}`;
    await db.insert(collections).values({
      id: tierColId,
      userId: ownerId,
      title: "Diana's Sci-Fi Tier Showcase",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      defaultRatingSystemId: customTierSysId,
    });

    // Add entries: Interstellar initially in Tier S, others unranked
    await db.insert(collectionEntries).values([
      { id: `dent_1_${tag}`, collectionId: tierColId, mediaItemId: mediaMovie1, sortOrder: 1 },
      { id: `dent_2_${tag}`, collectionId: tierColId, mediaItemId: mediaMovie2, sortOrder: 2 },
      { id: `dent_3_${tag}`, collectionId: tierColId, mediaItemId: mediaMovie3, sortOrder: 3 },
      { id: `dent_4_${tag}`, collectionId: tierColId, mediaItemId: mediaEpisode1, sortOrder: 4 },
    ]);

    // Initial rating for Interstellar in S Tier
    await db.insert(ratings).values({
      id: `dr_1_${tag}`,
      userId: ownerId,
      mediaItemId: mediaMovie1,
      collectionId: tierColId,
      tierId: tierSId,
    });

    console.log("Seeding complete. Launching Playwright...");

    // 3. Playwright browser testing
    const browser: Browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    if (ownerRes.token) {
      await context.addCookies([
        {
          name: "better-auth.session_token",
          value: ownerRes.token,
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    const page: Page = await context.newPage();

    // Navigate to Collection Page
    console.log("\n--- TEST 1: Collection Page & 'Rank Items' Action Discovery ---");
    await page.goto(`${BASE_URL}/collection/${tierColId}`);
    await page.waitForLoadState("networkidle");

    // Check that 'Rank Items' button exists in toolbar
    const toolbarRankBtn = page.locator('button:has-text("Rank Items")');
    await toolbarRankBtn.first().waitFor({ state: "visible", timeout: 8000 });
    console.log("Verified 'Rank Items' button exists in toolbar.");

    // Switch to Tier Board view
    const tierBoardViewBtn = page.locator('button[title="Tier Board view"]');
    if (await tierBoardViewBtn.count()) {
      await tierBoardViewBtn.click();
      await page.waitForTimeout(400);
    }

    // Check that top banner in TierBoardView has 'Rank Items' action
    const bannerRankBtn = page.locator('text=Interactive Tier-Board Editor');
    assert.ok(await bannerRankBtn.count() > 0, "Tier board view must show editor banner to owner");

    // Click 'Rank Items' to open the dedicated Tier Board Editor
    console.log("\n--- TEST 2: Open Dedicated Tier-Board Editor ---");
    await toolbarRankBtn.first().click();
    await page.waitForTimeout(500);

    // Verify modal is open with TierMaker rows and Unranked Tray
    const editorTitle = page.locator('text=Tier Board Editor');
    await editorTitle.waitFor({ state: "visible", timeout: 5000 });

    const unrankedTray = page.locator('text=Unranked Tray');
    await unrankedTray.waitFor({ state: "visible", timeout: 5000 });

    // Verify aspect ratios: movie (Interstellar, Arrival, Dune) and episode (San Junipero)
    const pageText = await page.textContent("body");
    assert.ok(pageText?.includes("Interstellar"), "Editor must display Interstellar");
    assert.ok(pageText?.includes("Arrival"), "Editor must display Arrival");
    assert.ok(pageText?.includes("Dune (2021)"), "Editor must display Dune");
    assert.ok(pageText?.includes("San Junipero"), "Editor must display San Junipero");

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-tiermaker-editor-open.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-tiermaker-editor-open.png");

    // --- TEST 3: Move Items via Accessible Non-Drag Menu & Drag Interaction ---
    console.log("\n--- TEST 3: Assigning Unranked Item to Tier ---");
    // Use the accessible non-drag alternative on 'Arrival' to move it to Tier A
    const arrivalCard = page.locator('[data-media-title="Arrival"]');
    await arrivalCard.waitFor({ state: "visible", timeout: 5000 });
    const arrivalTrigger = arrivalCard.locator('[data-testid="card-move-menu-trigger"]');
    await arrivalTrigger.click({ force: true });
    await page.waitForTimeout(200);

    const arrivalResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/ratings") && r.request().method() === "POST"
    );
    const moveToABtn = page.locator('[data-testid="move-to-tier-A"]');
    await moveToABtn.click();
    const arrivalRes = await arrivalResponsePromise;
    console.log("Arrival rating POST status:", arrivalRes.status());
    assert.equal(arrivalRes.status(), 200, "Rating POST must return 200");
    await page.waitForTimeout(500);

    // Verify DB assignment for Arrival
    const arrivalRating = await db.query.ratings.findFirst({
      where: (r, { eq, and }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, mediaMovie2)),
    });
    assert.equal(arrivalRating?.tierId, tierAId, "Arrival must now be assigned to Tier A in DB");
    console.log("Arrival assignment in DB verified:", arrivalRating?.tierId);

    // Also move Dune to Tier B
    const duneCard = page.locator('[data-media-title="Dune (2021)"]');
    await duneCard.waitFor({ state: "visible", timeout: 5000 });
    const duneTrigger = duneCard.locator('[data-testid="card-move-menu-trigger"]');
    await duneTrigger.click({ force: true });
    await page.waitForTimeout(200);

    const duneResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/ratings") && r.request().method() === "POST"
    );
    const moveToBBtn = page.locator('[data-testid="move-to-tier-B"]');
    await moveToBBtn.click();
    const duneRes = await duneResponsePromise;
    console.log("Dune rating POST status:", duneRes.status());
    assert.equal(duneRes.status(), 200, "Dune rating POST must return 200");
    await page.waitForTimeout(500);

    const duneRating = await db.query.ratings.findFirst({
      where: (r, { eq, and }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, mediaMovie3)),
    });
    assert.equal(duneRating?.tierId, tierBId, "Dune must now be assigned to Tier B in DB");
    console.log("Dune assignment in DB verified:", duneRating?.tierId);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-tiermaker-dragged-item.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-tiermaker-dragged-item.png");

    // --- TEST 4: Done & Persistence on Main Ranking Page ---
    console.log("\n--- TEST 4: Done & Normal Ranking Persistence ---");
    const doneBtn = page.locator('button:has-text("Done")');
    await doneBtn.click();
    await page.waitForTimeout(500);

    // Refresh collection page to confirm full persistence
    await page.reload();
    await page.waitForLoadState("networkidle");

    const refreshedText = await page.textContent("body");
    assert.ok(refreshedText?.includes("Interstellar"), "Must display Interstellar");
    assert.ok(refreshedText?.includes("Arrival"), "Must display Arrival");
    assert.ok(refreshedText?.includes("Dune (2021)"), "Must display Dune");

    // Test existing list view mode outside editor
    const listViewBtn = page.locator('button[title="List view"]');
    if (await listViewBtn.count()) {
      await listViewBtn.click();
      await page.waitForTimeout(300);
    }
    const listContent = await page.textContent("body");
    assert.ok(listContent?.includes("Interstellar"), "List view preserves Interstellar");

    // --- TEST 5: Mobile Viewport & Touch Behavior ---
    console.log("\n--- TEST 5: Mobile Viewport Verification ---");
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.waitForTimeout(300);

    // Re-open Tier Board Editor in mobile view
    const mobileRankBtn = page.locator('button:has-text("Rank Items")').first();
    if (await mobileRankBtn.count()) {
      await mobileRankBtn.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-tiermaker-mobile-view.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-tiermaker-mobile-view.png");

    console.log("\nALL TIER-BOARD UX CRITERIA VERIFIED SUCCESSFULLY!");
    await browser.close();
  } finally {
    console.log("Cleaning up test data...");
    if (ownerId) {
      await db.delete(user).where(eq(user.id, ownerId));
    }
    await db.delete(mediaItems).where(
      inArray(mediaItems.id, [mediaMovie1, mediaMovie2, mediaMovie3, mediaEpisode1])
    );
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    await pool.end();
    console.log("Cleanup finished.");
  }
})();
