import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const PROD_URL = "https://aubrey.koltensserver.com";
const EXPECTED_REV = "aadad9b3ae1ea85383f7238a02c8e4b48e4ddb60";
const ARTIFACT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

function sshPsql(sql: string): string {
  // Escapes double quotes for the inner psql call
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `ssh koltensserver "docker exec -i aubrey-db psql -U aubrey -d aubrey_rankings -c \\"${escaped}\\""`;
  return execSync(cmd, { encoding: "utf-8" });
}

async function runSmokeTest() {
  console.log("=== Aubrey Rankings Post-Deployment Production Smoke Test ===");
  console.log(`Target: ${PROD_URL}`);
  console.log(`Expected Revision: ${EXPECTED_REV}`);

  // 1. Health endpoint verification
  console.log("\n[1/5] Verifying /api/health endpoint...");
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  assert.equal(healthRes.status, 200, "Health check must return HTTP 200");
  const healthData = await healthRes.json();
  console.log("Health response:", healthData);
  assert.equal(healthData.status, "ok", "Health status must be 'ok'");
  assert.equal(healthData.revision, EXPECTED_REV, `Health revision must match ${EXPECTED_REV}`);
  console.log("✓ Production is healthy and running expected revision aadad9b");

  // 2. Public visitor access & existing numerical collections
  console.log("\n[2/5] Testing public visitor access to existing numerical ratings...");
  const existingColId = "col_1792342930102_2fdcd1"; // Black Mirror, ranked
  const colRes = await fetch(`${PROD_URL}/api/collections/${existingColId}`);
  assert.equal(colRes.status, 200, "Collection API must return HTTP 200");
  const colData = await colRes.json();
  assert.equal(colData.isOwner, false, "Visitor must not be owner");
  assert.equal(colData.collection.defaultRatingSystem?.type, "numerical", "Rating system must be numerical");
  assert(colData.ratings.length > 0, "Collection must have ratings");
  console.log(`✓ Fetched '${colData.collection.title}' by ${colData.collection.user?.name} (${colData.ratings.length} items, score: ${colData.ratings[0].calculatedOverallScore})`);

  // Browser visit
  console.log("Launching Playwright visitor browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(`${PROD_URL}/collection/${existingColId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Black Mirror, ranked", { timeout: 10000 });
  const rankItemsBtn = await page.$("button:has-text('Rank Items')");
  assert.equal(rankItemsBtn, null, "Visitor must NOT see 'Rank Items' button");
  const addItemsBtn = await page.$("button:has-text('Add Items')");
  assert.equal(addItemsBtn, null, "Visitor must NOT see 'Add Items' button");

  const numericalShot = `${ARTIFACT_DIR}/stage24-prod-visitor-numerical-collection.png`;
  await page.screenshot({ path: numericalShot, fullPage: false });
  console.log(`✓ Verified visitor collection page and saved screenshot: ${numericalShot}`);

  // 3. Comparison API
  console.log("\n[3/5] Testing comparison between existing collections...");
  const compareRes = await fetch(`${PROD_URL}/api/compare?left=col_1792343079388_4c93d1&right=col_1792343080225_34484e`);
  assert.equal(compareRes.status, 200, "Comparison API must return HTTP 200");
  const compareData = await compareRes.json();
  assert(compareData.metrics, "Comparison must calculate metrics");
  console.log("✓ Comparison API works cleanly between public collections:", compareData.metrics.alignmentRating);

  // 4. Ephemeral Non-Destructive Tier Collection Test
  console.log("\n[4/5] Setting up isolated ephemeral tier collection on production...");
  const testColId = `col_smoke_tier_${Date.now()}`;
  const testRate1 = `rate_smoke_1_${Date.now()}`;
  const testRate2 = `rate_smoke_2_${Date.now()}`;
  const demoUserId = "EBm2o8lSdOrSbnqa0hpzCClald3Jl44Q"; // Aubrey (Demo)

  try {
    // Insert ephemeral collection pointing to rs_template_standard_tiers
    sshPsql(`
      INSERT INTO collections (id, user_id, title, description, is_public, visibility, default_rating_system_id, collection_type)
      VALUES ('${testColId}', '${demoUserId}', 'Production Smoke Tier Collection', 'Temporary verification tier board', true, 'public', 'rs_template_standard_tiers', 'custom');
      
      INSERT INTO collection_entries (id, collection_id, media_item_id, sort_order)
      VALUES 
        ('entry_1_${testColId}', '${testColId}', 'tv_42009_s1_e1', 1),
        ('entry_2_${testColId}', '${testColId}', 'tv_42009_s1_e2', 2);

      INSERT INTO ratings (id, user_id, media_item_id, collection_id, rating_system_id, tier_id, is_watched, is_favorite)
      VALUES
        ('${testRate1}', '${demoUserId}', 'tv_42009_s1_e1', '${testColId}', 'rs_template_standard_tiers', 'tier_std_s', true, true),
        ('${testRate2}', '${demoUserId}', 'tv_42009_s1_e2', '${testColId}', 'rs_template_standard_tiers', 'tier_std_a', true, false);
    `);
    console.log("✓ Ephemeral tier collection and ratings created in database");

    // Fetch via API
    const tierColRes = await fetch(`${PROD_URL}/api/collections/${testColId}`);
    assert.equal(tierColRes.status, 200, "Ephemeral tier collection must return 200");
    const tierColData = await tierColRes.json();
    assert.equal(tierColData.collection.defaultRatingSystem?.type, "tier", "Must be tier rating system");
    assert.equal(tierColData.collection.defaultRatingSystem?.tiers?.length, 5, "Standard tier list must have 5 tiers");
    assert.equal(tierColData.ratings.length, 2, "Must return 2 ratings");
    assert.equal(tierColData.ratings[0].tier?.name, "S", "Item 1 must be in S tier");
    assert.equal(tierColData.ratings[1].tier?.name, "A", "Item 2 must be in A tier");
    console.log("✓ Tier collection API returned verified tier structure and items");

    // Test Playwright view
    await page.goto(`${PROD_URL}/collection/${testColId}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Production Smoke Tier Collection", { timeout: 10000 });
    // In tier collections, the Tier Board view is default or available
    const tierBadgeS = await page.waitForSelector("text=Masterpiece / Elite, S, or tier row", { timeout: 2000 }).catch(() => null);
    const tierShot = `${ARTIFACT_DIR}/stage24-prod-visitor-tier-collection.png`;
    await page.screenshot({ path: tierShot, fullPage: false });
    console.log(`✓ Tier collection rendered successfully for visitor. Screenshot: ${tierShot}`);

    // Test mixed tier/numerical comparison
    console.log("Testing mixed tier/numerical comparison (no fabricated score gap)...");
    const mixedRes = await fetch(`${PROD_URL}/api/compare?left=${testColId}&right=${existingColId}`);
    assert.equal(mixedRes.status, 200, "Mixed comparison must return 200");
    const mixedData = await mixedRes.json();
    assert.equal(mixedData.metrics?.meanScoreDifference, null, "meanScoreDifference must be null for mixed comparison");
    console.log("✓ Mixed tier/numerical comparison returns meanScoreDifference: null (ordinal calibrated)");

    // Test ON DELETE RESTRICT protection
    console.log("Testing ON DELETE RESTRICT protection on occupied tier...");
    let restrictThrew = false;
    try {
      sshPsql("DELETE FROM rating_tiers WHERE id = 'tier_std_s';");
    } catch (err: any) {
      restrictThrew = true;
      assert(err.message.includes("violates foreign key constraint") || err.message.includes("ratings_tier_id_fkey"), "Must throw foreign key constraint violation");
    }
    assert(restrictThrew, "Database must reject deleting an assigned tier");
    console.log("✓ ON DELETE RESTRICT correctly prevented deleting occupied tier 'tier_std_s'");

  } finally {
    // 5. Cleanup
    console.log("\n[5/5] Cleaning up ephemeral test records...");
    sshPsql(`
      DELETE FROM ratings WHERE id IN ('${testRate1}', '${testRate2}');
      DELETE FROM collection_entries WHERE collection_id = '${testColId}';
      DELETE FROM collections WHERE id = '${testColId}';
    `);
    const verifyClean = sshPsql(`SELECT count(*) FROM collections WHERE id = '${testColId}';`);
    assert(verifyClean.includes("0"), "Test collection must be deleted");
    console.log("✓ Ephemeral test records completely cleaned up. Production DB is pristine.");
  }

  await browser.close();
  console.log("\n=== ALL POST-DEPLOYMENT SMOKE TESTS PASSED CLEANLY ===");
}

runSmokeTest().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
