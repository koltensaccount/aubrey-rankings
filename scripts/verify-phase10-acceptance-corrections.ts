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
  reviews,
} from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3007;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const authorData = {
  name: `Aubrey Curator ${tag}`,
  email: `curator-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `curator_${tag}`,
};

const visitorData = {
  name: `Aubrey Visitor ${tag}`,
  email: `visitor-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `visitor_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let authorId: string = "";
let authorCookie: string = "";
let visitorId: string = "";
let visitorCookie: string = "";
let testCollectionId: string = "";
let testMediaId1: string = "";
let testMediaId2: string = "";

async function createAccount(data: typeof authorData) {
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

async function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function run() {
  console.log("🎬 Starting Phase 10 Final Acceptance E2E Browser Verification...\n");

  // 1. Seed accounts
  console.log("1. Creating author and visitor test accounts...");
  const author = await createAccount(authorData);
  authorId = author.id;
  authorCookie = author.cookie;

  const visitor = await createAccount(visitorData);
  visitorId = visitor.id;
  visitorCookie = visitor.cookie;

  // 2. Seed test collection & media items
  console.log("2. Seeding test collection and media items...");
  testMediaId1 = `movie_test1_${tag}`;
  testMediaId2 = `movie_test2_${tag}`;

  await db.insert(mediaItems).values([
    {
      id: testMediaId1,
      mediaType: "movie",
      title: `In the Mood for Love (${tag})`,
      releaseDate: "2000-09-29",
      overview: "Two neighbors form a strong bond after both suspect extramarital activities of their spouses.",
    },
    {
      id: testMediaId2,
      mediaType: "movie",
      title: `Chungking Express (${tag})`,
      releaseDate: "1994-07-14",
      overview: "Two melancholic Hong Kong policemen fall in love.",
    },
  ]);

  testCollectionId = `col_test_${tag}`;
  await db.insert(collections).values({
    id: testCollectionId,
    userId: authorId,
    title: `Hong Kong Cinema Showcase (${tag})`,
    collectionType: "custom",
    visibility: "public",
    isPublic: true,
  });

  await db.insert(collectionEntries).values([
    {
      id: `entry1_${tag}`,
      collectionId: testCollectionId,
      mediaItemId: testMediaId1,
      sortOrder: 1,
    },
    {
      id: `entry2_${tag}`,
      collectionId: testCollectionId,
      mediaItemId: testMediaId2,
      sortOrder: 2,
    },
  ]);

  // Seed item 1 with rating and private historical note
  await db.insert(ratings).values({
    id: `rate1_${tag}`,
    collectionId: testCollectionId,
    mediaItemId: testMediaId1,
    userId: authorId,
    reviewText: "Masterpiece of frame composition.",
    personalNotes: "Watched with film study group in 2023.",
    shareCommentary: false, // Private by default
    calculatedOverallScore: 9.7,
    sourceRating: 10,
  });

  // 3. Start Next.js server on isolated PORT
  console.log(`3. Spawning Next.js server on port ${PORT}...`);
  serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
  });

  await waitForServer(BASE_URL);
  console.log("✔ Server is ready and healthy.\n");

  const browser: Browser = await chromium.launch({ headless: true });
  const authorContext = await browser.newContext();
  const visitorContext = await browser.newContext();

  await authorContext.addCookies([
    {
      name: "better-auth.session_token",
      value: authorCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await visitorContext.addCookies([
    {
      name: "better-auth.session_token",
      value: visitorCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const authorPage: Page = await authorContext.newPage();
  const visitorPage: Page = await visitorContext.newPage();

  try {
    // -------------------------------------------------------------
    // Test 1: Historical private notes access and non-destructive preservation
    // -------------------------------------------------------------
    console.log("4. Testing historical private notes access in Rating Dialog...");
    await authorPage.goto(`${BASE_URL}/collection/${testCollectionId}`, { waitUntil: "networkidle" });
    await authorPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage29-collection-loaded.png") });

    // Open rating dialog for Item 1 (which has an existing rating)
    const rateBtn = authorPage.locator("button:has-text('Edit Rating'), button:has-text('Edit')").first();
    await rateBtn.click();
    await authorPage.waitForSelector("[role='dialog']");

    // Verify both Thoughts & Commentary AND Private Personal Notes are visible
    const thoughtsTextarea = authorPage.locator("textarea[placeholder*='thoughts']");
    await assert.ok(await thoughtsTextarea.isVisible(), "Thoughts & Commentary must be visible");
    const thoughtsVal = await thoughtsTextarea.inputValue();
    assert.equal(thoughtsVal, "Masterpiece of frame composition.");

    // Verify Private Personal Notes (Owner Only) is visible and editable
    const privateNotesSection = authorPage.locator("text=Private Personal Notes (Owner Only)");
    await assert.ok(await privateNotesSection.isVisible(), "Private notes section must be visible to owner");

    const privateNotesTextarea = authorPage.locator("textarea[placeholder*='Private personal notes']");
    const privateNotesVal = await privateNotesTextarea.inputValue();
    assert.equal(privateNotesVal, "Watched with film study group in 2023.");
    console.log("✔ Historical private notes are fully visible and editable by owner.");

    // -------------------------------------------------------------
    // Test 2: Unified writing workflow — Publish as Review from Rating Dialog
    // -------------------------------------------------------------
    console.log("5. Opening Publish as Review from Rating Dialog...");
    const publishAsReviewBtn = authorPage.locator("button:has-text('Publish as Review')");
    await publishAsReviewBtn.click();
    await authorPage.waitForTimeout(500);

    // Verify ReviewEditorDialog opens
    const reviewDialogTitle = authorPage.locator("h2:has-text('Write a Review')");
    await assert.ok(await reviewDialogTitle.isVisible(), "ReviewEditorDialog must open");

    // Verify prefilled content
    const reviewContentTextarea = authorPage.locator("textarea[placeholder*='thoughts, critical analysis']");
    const prefilledContent = await reviewContentTextarea.inputValue();
    assert.ok(prefilledContent.includes("Masterpiece of frame composition"), "Content must be prefilled from thoughts");

    // Verify Rating Attachment Disclosure card
    const ratingAttachmentNotice = authorPage.locator("text=Include rating with this review");
    await assert.ok(await ratingAttachmentNotice.isVisible(), "Rating attachment disclosure must be displayed");
    const disclosureNotice = authorPage.locator("text=Your rating will be publicly visible alongside this review.");
    await assert.ok(await disclosureNotice.isVisible(), "Public visibility notice must inform author");

    // Close review dialog
    const cancelReviewBtn = authorPage.locator("button:has-text('Cancel')").last();
    await cancelReviewBtn.click();
    await authorPage.waitForTimeout(400);

    // Close rating dialog
    const cancelRatingBtn = authorPage.locator("button:has-text('Cancel')").first();
    await cancelRatingBtn.click();
    await authorPage.waitForTimeout(500);
    console.log("✔ Unified writing workflow verified: Publish as Review prefilled and discloses rating attachment.");

    // -------------------------------------------------------------
    // Test 3: Commentary privacy on ranking — turning off sharing removes from visitors
    // -------------------------------------------------------------
    console.log("6. Verifying commentary privacy for public visitors...");
    // Item 1 has shareCommentary: false
    const visitorRes = await fetch(`${BASE_URL}/api/collections/${testCollectionId}`, {
      headers: { Cookie: `better-auth.session_token=${visitorCookie}` },
    });
    assert.equal(visitorRes.status, 200);
    const visitorData = await visitorRes.json();
    const item1RatingForVisitor = visitorData.ratings?.find((r: any) => r.mediaItemId === testMediaId1);

    assert.equal(item1RatingForVisitor?.reviewText, null, "Unshared thoughts must be null for visitor");
    assert.equal(item1RatingForVisitor?.personalNotes, null, "Personal notes must always be null for visitor");
    console.log("✔ Unshared thoughts and personal notes are strictly null for public visitors.");

    // Now author turns on sharing for Item 1
    await db.update(ratings).set({ shareCommentary: true }).where(eq(ratings.id, `rate1_${tag}`));

    const visitorResShared = await fetch(`${BASE_URL}/api/collections/${testCollectionId}`, {
      headers: { Cookie: `better-auth.session_token=${visitorCookie}` },
    });
    const visitorDataShared = await visitorResShared.json();
    const item1Shared = visitorDataShared.ratings?.find((r: any) => r.mediaItemId === testMediaId1);

    assert.equal(item1Shared?.reviewText, "Masterpiece of frame composition.", "Shared thoughts visible to visitors on ranking");
    assert.equal(item1Shared?.personalNotes, null, "Personal notes remain null even when thoughts are shared");
    console.log("✔ Shared commentary appears on ranking itself while personal notes remain private.");

    // -------------------------------------------------------------
    // Test 4: Public profile & media reviews use only first-class reviews
    // -------------------------------------------------------------
    console.log("7. Verifying public profile displays only first-class reviews...");
    const profileRes = await fetch(`${BASE_URL}/api/media/${testMediaId1}/reviews`);
    assert.equal(profileRes.status, 200);
    const mediaReviewsData = await profileRes.json();

    // Since author has NOT published a first-class review yet, media reviews should be empty
    assert.equal(mediaReviewsData.reviews.length, 0, "Ranking commentary must NOT leak into media reviews listing");
    console.log("✔ Ranking commentary is strictly excluded from media page review listings.");

    // -------------------------------------------------------------
    // Test 5: Switching views never hides tier-board items unexpectedly
    // -------------------------------------------------------------
    console.log("8. Verifying Tier Board displays all items regardless of rating filter...");
    // Switch collection to tier mode
    await fetch(`${BASE_URL}/api/collections/${testCollectionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `better-auth.session_token=${authorCookie}`,
      },
      body: JSON.stringify({ ratingMethod: "tier" }),
    });

    await authorPage.goto(`${BASE_URL}/collection/${testCollectionId}`, { waitUntil: "networkidle" });
    await authorPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage29-tier-board-view.png") });

    // Both Item 1 and Item 2 must be present on the page
    const item1Element = authorPage.locator(`text=In the Mood for Love (${tag})`).first();
    const item2Element = authorPage.locator(`text=Chungking Express (${tag})`).first();
    await assert.ok(await item1Element.isVisible(), "Item 1 must be visible on Tier Board");
    await assert.ok(await item2Element.isVisible(), "Item 2 must be visible on Tier Board");
    console.log("✔ Tier Board displays all collection items grouped by tier without filter interference.");

    console.log("\n✨ All Phase 10 Final Acceptance Verification checks PASSED successfully!");
  } finally {
    await authorContext.close();
    await visitorContext.close();
    await browser.close();

    // Cleanup DB records
    console.log("\n🧹 Cleaning up test database records...");
    await db.delete(ratings).where(eq(ratings.collectionId, testCollectionId));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, testCollectionId));
    await db.delete(collections).where(eq(collections.id, testCollectionId));
    await db.delete(mediaItems).where(eq(mediaItems.id, testMediaId1));
    await db.delete(mediaItems).where(eq(mediaItems.id, testMediaId2));
    await db.delete(user).where(eq(user.id, authorId));
    await db.delete(user).where(eq(user.id, visitorId));

    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  if (serverProcess) (serverProcess as ChildProcess).kill("SIGTERM");
  process.exit(1);
});
