import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";
const MANIFEST_FILE = path.join(process.env.HOME || "", ".aubrey-rankings", "demo-manifest.json");
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
const bmColId = manifest.collections.black_mirror.id;

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  console.log("1. Capturing Prototype Feed...");
  await page.goto("http://localhost:3000/prototype", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-feed-prototype.png"), fullPage: false });

  console.log("2. Capturing Production Live Feed...");
  await page.goto("https://aubrey.koltensserver.com/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-feed-production.png"), fullPage: false });

  console.log("3. Capturing Prototype Profile...");
  await page.goto("http://localhost:3000/prototype/profile", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-profile-prototype.png"), fullPage: false });

  console.log("4. Capturing Production Demo Aubrey Profile...");
  await page.goto("https://aubrey.koltensserver.com/u/demo_aubrey", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-profile-production.png"), fullPage: false });

  console.log("5. Capturing Prototype Ranking...");
  await page.goto("http://localhost:3000/prototype/ranking", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-ranking-prototype.png"), fullPage: false });

  console.log("6. Capturing Production Demo Black Mirror Ranking...");
  await page.goto(`https://aubrey.koltensserver.com/collection/${bmColId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "community-ranking-production.png"), fullPage: false });

  await browser.close();
  console.log("All screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
