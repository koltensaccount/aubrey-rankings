import assert from "node:assert/strict";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const PROD_URL = "https://aubrey.koltensserver.com";
const EXPECTED_REV = "5189efeb877ac44afb5c9a0e28044d8984006c81";
const ARTIFACT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

async function verifyProduction() {
  console.log("=== Aubrey Rankings Live Production Verification ===");
  console.log(`Target: ${PROD_URL}`);
  console.log(`Expected Revision: ${EXPECTED_REV}`);

  // 1. Health check & Revision
  console.log("\n[1/3] Verifying live /api/health endpoint...");
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  assert.equal(healthRes.status, 200, "Health check must return HTTP 200");
  const healthData = await healthRes.json();
  console.log("Health check response:", healthData);
  assert.equal(healthData.status, "ok", "Status must be ok");
  assert.equal(healthData.revision, EXPECTED_REV, `Production must be running revision ${EXPECTED_REV}`);
  console.log("✓ Live production revision strictly matches expected git commit!");

  // 2. Playwright smoke test of live site
  console.log("\n[2/3] Verifying live UI with Playwright...");
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page: Page = await context.newPage();

  try {
    // Check Home page
    await page.goto(`${PROD_URL}/`, { waitUntil: "networkidle" });
    const title = await page.title();
    console.log("Home page title:", title);
    assert.ok(title.includes("Aubrey"), "Title must contain Aubrey");

    const homeShot = path.join(ARTIFACT_DIR, "stage25-prod-live-home.png");
    await page.screenshot({ path: homeShot, fullPage: false });
    console.log(`✓ Home page screenshot saved: ${homeShot}`);

    // Check Explore page
    await page.goto(`${PROD_URL}/explore`, { waitUntil: "networkidle" });
    const exploreShot = path.join(ARTIFACT_DIR, "stage25-prod-live-explore.png");
    await page.screenshot({ path: exploreShot, fullPage: false });
    console.log(`✓ Explore page screenshot saved: ${exploreShot}`);

    // Check public ranking page
    await page.goto(`${PROD_URL}/collection/col_1792343079388_4c93d1`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 10000 });
    const colShot = path.join(ARTIFACT_DIR, "stage25-prod-live-public-collection.png");
    await page.screenshot({ path: colShot, fullPage: false });
    console.log(`✓ Public collection page screenshot saved: ${colShot}`);

    console.log("\n[3/3] Live production smoke test passed cleanly!");
  } finally {
    await browser.close();
  }
}

verifyProduction().catch((err) => {
  console.error("❌ Production verification failed:", err);
  process.exit(1);
});
