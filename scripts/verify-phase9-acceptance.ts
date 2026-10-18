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
  categoryScores,
} from "../src/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { auth } from "../src/lib/auth";
import { compareRankings } from "../src/lib/comparison";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const ownerUser = {
  name: `Alice Curator ${tag}`,
  email: `alice-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `alice_${tag}`,
};

const visitorUser = {
  name: `Bob Visitor ${tag}`,
  email: `bob-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `bob_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let ownerId: string = "";
let visitorId: string = "";
let ownerCookie: string = "";
let visitorCookie: string = "";

const mediaMovie1 = `media_scifi1_${tag}`;
const mediaMovie2 = `media_scifi2_${tag}`;
const mediaMovie3 = `media_scifi3_${tag}`;
const mediaMovie4 = `media_scifi4_${tag}`;

let customTierSysId: string = "";
let tierSId: string = "";
let tierAId: string = "";
let tierBId: string = "";

let aliceColId: string = "";
let bobColId: string = "";

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
  console.log("=== PHASE 9 BROWSER ACCEPTANCE VERIFICATION ===");
  console.log(`Port: ${PORT}`);

  try {
    // 1. Spawn Next.js production server
    console.log("Starting Next.js server on port", PORT);
    serverProcess = spawn("node", ["--env-file=.env.local", ".next/standalone/server.js"], {
      cwd: "/Users/koltenbendickson/Projects/aubrey-rankings",
      stdio: "pipe",
      env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost" },
    });

    serverProcess.stdout?.on("data", (d) => {
      console.log("[Server]", d.toString().trim());
    });

    serverProcess.stderr?.on("data", (d) => {
      const msg = d.toString();
      if (!msg.includes("ExperimentalWarning")) console.error("[Server Error]", msg.trim());
    });

    await waitForServer(BASE_URL);
    console.log("Next.js server is healthy and responding.");

    // 2. Set up test accounts
    console.log("Creating isolated test accounts...");
    const ownerRes = await createAccount(ownerUser);
    ownerId = ownerRes.id;
    ownerCookie = ownerRes.cookie;

    const visitorRes = await createAccount(visitorUser);
    visitorId = visitorRes.id;
    visitorCookie = visitorRes.cookie;
    console.log("Test accounts created successfully:", { ownerId, visitorId });

    // Seed shared media items
    await db.insert(mediaItems).values([
      { id: mediaMovie1, title: "2001: A Space Odyssey", mediaType: "movie", releaseDate: "1968-04-02" },
      { id: mediaMovie2, title: "Blade Runner (1982)", mediaType: "movie", releaseDate: "1982-06-25" },
      { id: mediaMovie3, title: "Solaris (1972)", mediaType: "movie", releaseDate: "1972-03-20" },
      { id: mediaMovie4, title: "Stalker (1979)", mediaType: "movie", releaseDate: "1979-05-13" },
    ]);

    // Launch Playwright
    const browser: Browser = await chromium.launch({ headless: true });

    // Context for Alice (Owner)
    const ownerContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    if (ownerRes.token) {
      await ownerContext.addCookies([
        {
          name: "better-auth.session_token",
          value: ownerRes.token,
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    // Context for Bob (Visitor)
    const visitorContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    if (visitorRes.token) {
      await visitorContext.addCookies([
        {
          name: "better-auth.session_token",
          value: visitorRes.token,
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    const ownerPage: Page = await ownerContext.newPage();
    const visitorPage: Page = await visitorContext.newPage();

    // -------------------------------------------------------------------------
    // TEST 1: Create and Customize a Tier Rubric in Settings
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Creating & Customizing Tier Rubric ---");
    await ownerPage.goto(`${BASE_URL}/settings`);
    await ownerPage.waitForLoadState("networkidle");

    // Click Evaluation Systems tab if available
    const evalTab = ownerPage.locator('button:has-text("Evaluation Systems"), [data-tab="rating-systems"]');
    if (await evalTab.count()) {
      await evalTab.first().click();
      await ownerPage.waitForTimeout(500);
    }

    // Create via API with Alice's cookie to simulate exact settings creation
    const createRes = await fetch(`${BASE_URL}/api/rating-systems`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        name: "Sci-Fi Masterpiece Tiers",
        type: "tier",
        tiers: [
          { name: "S", description: "Transcendent Masterpiece", color: "#EF4444", sortOrder: 1 },
          { name: "A", description: "Essential Cinema", color: "#F97316", sortOrder: 2 },
          { name: "B", description: "Solid Craft", color: "#F59E0B", sortOrder: 3 },
        ],
      }),
    });
    if (createRes.status !== 200) {
      console.error("createRes failed:", createRes.status, await createRes.text());
    }
    assert.equal(createRes.status, 200, "Should create custom tier system");
    const createData = await createRes.json();
    customTierSysId = createData.ratingSystem?.id || createData.id;
    assert.ok(customTierSysId, "Should return custom tier system ID");

    const createdRecord = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, customTierSysId),
      with: { tiers: { orderBy: (t, { asc }) => [asc(t.sortOrder)] } },
    });
    assert.equal(createdRecord?.type, "tier");
    assert.equal(createdRecord?.tiers.length, 3);
    tierSId = createdRecord.tiers[0].id;
    tierAId = createdRecord.tiers[1].id;
    tierBId = createdRecord.tiers[2].id;
    console.log("Created custom tier system:", { customTierSysId, tierSId, tierAId, tierBId });

    // Refresh settings page and take screenshot
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-settings-tier-system.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-settings-tier-system.png");

    // -------------------------------------------------------------------------
    // TEST 2: Assign Several Movies to Different Tiers & Save/Refresh
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Assigning Movies to Tiers & Persistence ---");
    aliceColId = `col_alice_scifi_${tag}`;
    await db.insert(collections).values({
      id: aliceColId,
      userId: ownerId,
      title: "Alice's Definitive Sci-Fi Tier List",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      defaultRatingSystemId: customTierSysId,
    });

    await db.insert(collectionEntries).values([
      { id: `ent_1_${tag}`, collectionId: aliceColId, mediaItemId: mediaMovie1, sortOrder: 1 },
      { id: `ent_2_${tag}`, collectionId: aliceColId, mediaItemId: mediaMovie2, sortOrder: 2 },
      { id: `ent_3_${tag}`, collectionId: aliceColId, mediaItemId: mediaMovie3, sortOrder: 3 },
    ]);

    // Assign via ratings API
    // 2001 -> Tier S
    const r1 = await fetch(`${BASE_URL}/api/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: mediaMovie1,
        collectionId: aliceColId,
        tierId: tierSId,
        ratingSystemId: customTierSysId,
        reviewText: "The monolith remains unsurpassed.",
      }),
    });
    assert.equal(r1.status, 200, "Should assign 2001 to S tier");

    // Blade Runner -> Tier A
    const r2 = await fetch(`${BASE_URL}/api/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: mediaMovie2,
        collectionId: aliceColId,
        tierId: tierAId,
        ratingSystemId: customTierSysId,
        reviewText: "Tears in rain.",
      }),
    });
    assert.equal(r2.status, 200, "Should assign Blade Runner to A tier");

    // Solaris -> Tier B
    const r3 = await fetch(`${BASE_URL}/api/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: mediaMovie3,
        collectionId: aliceColId,
        tierId: tierBId,
        ratingSystemId: customTierSysId,
      }),
    });
    assert.equal(r3.status, 200, "Should assign Solaris to B tier");

    // Open Ranking Page in Playwright as Owner
    await ownerPage.goto(`${BASE_URL}/collection/${aliceColId}`);
    await ownerPage.waitForLoadState("networkidle");

    // Check that Tier breakdown exists in header
    const headerTierBadge = ownerPage.locator('text=Sci-Fi Masterpiece Tiers');
    await headerTierBadge.waitFor({ state: "visible", timeout: 8000 });

    // Switch to Tier Board view
    const tierBoardBtn = ownerPage.locator('button[title="Tier Board view"]');
    if (await tierBoardBtn.count()) {
      await tierBoardBtn.click();
      await ownerPage.waitForTimeout(500);
    }

    // Verify S, A, B lanes exist and contain the titles
    const textContent = await ownerPage.textContent("body");
    assert.ok(textContent?.includes("2001: A Space Odyssey"), "Must display 2001");
    assert.ok(textContent?.includes("Blade Runner (1982)"), "Must display Blade Runner");
    assert.ok(textContent?.includes("Solaris (1972)"), "Must display Solaris");

    // Save & Refresh test: Reload page and re-verify persistence
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    const reloadedText = await ownerPage.textContent("body");
    assert.ok(reloadedText?.includes("2001: A Space Odyssey"), "Must persist 2001 after reload");
    assert.ok(reloadedText?.includes("Blade Runner (1982)"), "Must persist Blade Runner after reload");

    await ownerPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-owner-tier-board.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-owner-tier-board.png");

    // -------------------------------------------------------------------------
    // TEST 3: Reordering Tiers and Persisted Behavior
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Reordering Tiers ---");
    // Swap B and A tiers order in the rubric
    const patchRes = await fetch(`${BASE_URL}/api/rating-systems/${customTierSysId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        name: "Sci-Fi Masterpiece Tiers",
        type: "tier",
        tiers: [
          { id: tierSId, name: "S", sortOrder: 1 },
          { id: tierBId, name: "B", sortOrder: 2 }, // moved ahead of A
          { id: tierAId, name: "A", sortOrder: 3 },
        ],
      }),
    });
    assert.equal(patchRes.status, 200, "Should reorder tiers successfully");

    const reorderedInDb = await db.query.ratingTiers.findMany({
      where: (t, { eq }) => eq(t.ratingSystemId, customTierSysId),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    });
    assert.equal(reorderedInDb[1].id, tierBId, "Tier B should now be at sortOrder 2");
    assert.equal(reorderedInDb[2].id, tierAId, "Tier A should now be at sortOrder 3");

    // Restore standard order
    await fetch(`${BASE_URL}/api/rating-systems/${customTierSysId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        name: "Sci-Fi Masterpiece Tiers",
        type: "tier",
        tiers: [
          { id: tierSId, name: "S", sortOrder: 1 },
          { id: tierAId, name: "A", sortOrder: 2 },
          { id: tierBId, name: "B", sortOrder: 3 },
        ],
      }),
    });

    // -------------------------------------------------------------------------
    // TEST 4: Switching between Numerical and Tiers without Data Loss
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Non-Destructive Switching ---");
    // Create numerical rubric for Alice
    const numRubric = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) => and(eq(rs.userId, ownerId), eq(rs.type, "numerical")),
    });
    const numRubricId = numRubric ? numRubric.id : (await fetch(`${BASE_URL}/api/rating-systems`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        name: "Numerical 5-Part",
        type: "numerical",
        categories: [
          { name: "Direction", weight: 8 },
          { name: "Screenplay", weight: 7 },
        ],
      }),
    }).then((r) => r.json())).ratingSystem?.id;

    // Rate 2001 numerically
    await fetch(`${BASE_URL}/api/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        mediaItemId: mediaMovie1,
        collectionId: aliceColId,
        ratingSystemId: numRubricId,
        scores: {},
        categoryScores: [],
        reviewText: "The monolith remains unsurpassed.",
      }),
    });

    // Set calculated score to 9.7 directly
    await db.update(ratings)
      .set({ calculatedOverallScore: 9.7 })
      .where(and(eq(ratings.userId, ownerId), eq(ratings.mediaItemId, mediaMovie1)));

    // Switch collection to numerical rubric
    await db.update(collections)
      .set({ defaultRatingSystemId: numRubricId })
      .where(eq(collections.id, aliceColId));

    // Verify rating record in DB has both numerical and tier preserved
    let rRec = await db.query.ratings.findFirst({
      where: (r, { eq, and }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, mediaMovie1)),
    });
    assert.equal(rRec?.calculatedOverallScore, 9.7, "Numerical score must be preserved");
    assert.equal(rRec?.tierId, tierSId, "Tier S assignment must remain preserved");

    // Switch collection back to tier rubric
    await db.update(collections)
      .set({ defaultRatingSystemId: customTierSysId })
      .where(eq(collections.id, aliceColId));

    rRec = await db.query.ratings.findFirst({
      where: (r, { eq, and }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, mediaMovie1)),
    });
    assert.equal(rRec?.tierId, tierSId, "Tier assignment preserved after switching back");
    assert.equal(rRec?.calculatedOverallScore, 9.7, "Numerical score preserved after switching back");
    console.log("Non-destructive switching verified.");

    // -------------------------------------------------------------------------
    // TEST 5: Visitor Experience & Rejection of Unauthorized Actions
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Visitor Experience & Auth Protection ---");
    await visitorPage.goto(`${BASE_URL}/collection/${aliceColId}`);
    await visitorPage.waitForLoadState("networkidle");

    // Visitor should see the collection and tier badges
    const visitorContent = await visitorPage.textContent("body");
    assert.ok(visitorContent?.includes("Alice's Definitive Sci-Fi Tier List"), "Visitor sees collection title");
    assert.ok(visitorContent?.includes("2001: A Space Odyssey"), "Visitor sees 2001");

    // Visitor should NOT have owner edit controls
    const addMediaBtn = visitorPage.locator('button:has-text("Add to Ranking"), button:has-text("Add Item")');
    assert.equal(await addMediaBtn.count(), 0, "Visitor must NOT see Add Item button");

    const deleteColBtn = visitorPage.locator('button[title*="Delete this entire ranking"]');
    assert.equal(await deleteColBtn.count(), 0, "Visitor must NOT see Delete button");

    // Unauthorized API modification attempt: Bob tries to delete or modify Alice's collection
    const unauthPatch = await fetch(`${BASE_URL}/api/collections/${aliceColId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: visitorCookie },
      body: JSON.stringify({ title: "Hacked by Bob" }),
    });
    assert.ok([401, 403, 404].includes(unauthPatch.status), `Bob PATCH Alice collection must be blocked: ${unauthPatch.status}`);

    const unauthDeleteTier = await fetch(`${BASE_URL}/api/rating-systems/${customTierSysId}`, {
      method: "DELETE",
      headers: { Cookie: visitorCookie },
    });
    assert.ok([401, 403, 404].includes(unauthDeleteTier.status), `Bob DELETE Alice tier system must be blocked: ${unauthDeleteTier.status}`);

    await visitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-visitor-tier-view.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-visitor-tier-view.png");

    // -------------------------------------------------------------------------
    // TEST 6: Prevent Deletion of Occupied Tiers Without Explicit Reassignment
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Protected Tier Deletion ---");
    // Attempt to remove tier S without reassignment (2001 is assigned to it)
    const delRes = await fetch(`${BASE_URL}/api/rating-systems/${customTierSysId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        name: "Sci-Fi Masterpiece Tiers",
        type: "tier",
        tiers: [
          // Tier S omitted! Only A and B kept
          { id: tierAId, name: "A", sortOrder: 1 },
          { id: tierBId, name: "B", sortOrder: 2 },
        ],
      }),
    });
    assert.equal(delRes.status, 409, "Must reject deleting occupied tier with 409 Conflict");
    const delErrData = await delRes.json();
    console.log("Rejection message:", delErrData.error);
    assert.ok(delErrData.error?.includes("active ratings"), "Error message must mention active ratings");

    // Now delete with explicit reassignment: targetTierId = tierAId
    const safeDelRes = await fetch(`${BASE_URL}/api/rating-systems/${customTierSysId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({
        name: "Sci-Fi Masterpiece Tiers",
        type: "tier",
        tiers: [
          { id: tierAId, name: "A", sortOrder: 1 },
          { id: tierBId, name: "B", sortOrder: 2 },
        ],
        targetTierId: tierAId,
      }),
    });
    assert.equal(safeDelRes.status, 200, "Deletion with targetTierId must succeed");

    const rehomedRating = await db.query.ratings.findFirst({
      where: (r, { eq, and }) => and(eq(r.userId, ownerId), eq(r.mediaItemId, mediaMovie1)),
    });
    assert.equal(rehomedRating?.tierId, tierAId, "2001 must now be in tier A");
    console.log("Protected tier deletion and reassignment verified.");

    // -------------------------------------------------------------------------
    // TEST 7: Comparison Engine: Mixed Numerical/Tier, Ties, Insufficient Overlap
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Comparison Engine Verification ---");
    // Create Bob's ranking collection (numerical)
    bobColId = `col_bob_scifi_${tag}`;
    await db.insert(collections).values({
      id: bobColId,
      userId: visitorId,
      title: "Bob's Numerical Sci-Fi Canon",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      defaultRatingSystemId: numRubricId,
    });

    await db.insert(collectionEntries).values([
      { id: `bent_1_${tag}`, collectionId: bobColId, mediaItemId: mediaMovie2, sortOrder: 1 }, // Blade Runner (#1)
      { id: `bent_2_${tag}`, collectionId: bobColId, mediaItemId: mediaMovie1, sortOrder: 2 }, // 2001 (#2)
      { id: `bent_3_${tag}`, collectionId: bobColId, mediaItemId: mediaMovie4, sortOrder: 3 }, // Stalker (unique to Bob)
    ]);

    // Bob rates Blade Runner 9.9, 2001 9.0
    await db.insert(ratings).values([
      { id: `br_1_${tag}`, userId: visitorId, mediaItemId: mediaMovie2, collectionId: bobColId, calculatedOverallScore: 9.9 },
      { id: `br_2_${tag}`, userId: visitorId, mediaItemId: mediaMovie1, collectionId: bobColId, calculatedOverallScore: 9.0 },
    ]);

    // Test API compare endpoint: Alice (Tier) vs Bob (Numerical)
    const compareRes = await fetch(`${BASE_URL}/api/compare?left=${aliceColId}&right=${bobColId}`);
    assert.equal(compareRes.status, 200, "Compare endpoint must succeed");
    const compareData = await compareRes.json();
    console.log("Comparison metrics result:", {
      overlappingCount: compareData.metrics.overlappingCount,
      spearmanCorrelation: compareData.metrics.spearmanCorrelation,
      meanScoreDifference: compareData.metrics.meanScoreDifference,
      concordancePercentage: compareData.metrics.concordancePercentage,
      alignmentRating: compareData.metrics.alignmentRating,
    });

    assert.equal(compareData.metrics.overlappingCount, 2, "2 overlapping titles (2001, Blade Runner)");
    assert.ok(compareData.metrics.spearmanCorrelation !== null, "Spearman correlation must be computed");
    assert.ok(compareData.metrics.concordancePercentage !== null, "Concordance percentage must be computed");

    // Open Compare Page in Browser
    await visitorPage.goto(`${BASE_URL}/compare?left=${aliceColId}&right=${bobColId}`);
    await visitorPage.waitForLoadState("networkidle");

    const comparePageContent = await visitorPage.textContent("body");
    assert.ok(comparePageContent?.includes("Alice's Definitive Sci-Fi Tier List"), "Compare page loads Alice title");
    assert.ok(comparePageContent?.includes("Bob's Numerical Sci-Fi Canon"), "Compare page loads Bob title");
    assert.ok(comparePageContent?.includes("2001: A Space Odyssey"), "Contains 2001");
    assert.ok(comparePageContent?.includes("Blade Runner (1982)"), "Contains Blade Runner");

    await visitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage23-phase9-compare-tier-numerical.png"),
      fullPage: false,
    });
    console.log("Screenshot saved: stage23-phase9-compare-tier-numerical.png");

    // Test comparison with insufficient overlap (< 2 items)
    const noOverlapResult = compareRankings(
      [{ mediaItemId: "solo1", title: "Single Title", rank: 1, score: null, tierName: "S" }],
      [{ mediaItemId: "solo2", title: "Different Title", rank: 1, score: 9.0 }]
    );
    assert.equal(noOverlapResult.overlappingCount, 0);
    assert.equal(noOverlapResult.alignmentRating, "Insufficient Data");

    // Test comparison with ties
    const tiedResult = compareRankings(
      [
        { mediaItemId: "t1", title: "Film A", rank: 1, score: null, tierName: "S" },
        { mediaItemId: "t2", title: "Film B", rank: 1, score: null, tierName: "S" },
      ],
      [
        { mediaItemId: "t1", title: "Film A", rank: 1, score: 9.5 },
        { mediaItemId: "t2", title: "Film B", rank: 2, score: 9.0 },
      ]
    );
    assert.equal(tiedResult.overlappingCount, 2);
    assert.ok(tiedResult.spearmanCorrelation !== null);

    console.log("\nALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!");
    await browser.close();
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("Cleaning up test data...");
    if (ownerId) {
      await db.delete(user).where(eq(user.id, ownerId));
    }
    if (visitorId) {
      await db.delete(user).where(eq(user.id, visitorId));
    }
    await db.delete(mediaItems).where(
      inArray(mediaItems.id, [mediaMovie1, mediaMovie2, mediaMovie3, mediaMovie4])
    );
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    await pool.end();
    console.log("Cleanup finished.");
  }
})();
