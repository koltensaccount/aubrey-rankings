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

const PORT = 3008;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const authorData = {
  name: `Release Blocker Tester ${tag}`,
  email: `tester-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `tester_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let authorId: string = "";
let authorCookie: string = "";
let testCollectionId: string = "";
let testMediaId1: string = "";
let testMediaId2: string = "";

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function startServer(): Promise<void> {
  console.log(`Starting Next.js test server on port ${PORT}...`);
  serverProcess = spawn(
    "node",
    [".next/standalone/server.js"],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
      stdio: "inherit",
    }
  );

  await waitForServer(BASE_URL);
  console.log(`Server ready on port ${PORT}`);
}

async function run() {
  console.log("=== Phase 10 Final Release Blockers Verification ===");

  // 1. Build test account
  console.log("1. Creating test user account...");
  const res = await auth.api.signUpEmail({
    body: {
      email: authorData.email,
      password: authorData.password,
      name: authorData.name,
    },
    asResponse: true,
  });
  assert.equal(res.status, 200, `Sign up for ${authorData.email} failed`);
  const rawCookie = res.headers.get("set-cookie") || "";
  const match = rawCookie.match(/better-auth\.session_token=([^;]+)/);
  assert.ok(match, "Failed to capture session token");
  authorCookie = match[1];

  const dbUser = await db.query.user.findFirst({
    where: eq(user.email, authorData.email),
  });
  assert.ok(dbUser, "User record not found in DB");
  authorId = dbUser.id;

  await db
    .update(user)
    .set({
      username: authorData.username,
      emailVerified: true,
    })
    .where(eq(user.id, authorId));

  // 2. Set up test media items and collection
  console.log("2. Setting up test media items and collection...");
  testMediaId1 = `movie_zebra_${tag}`;
  testMediaId2 = `movie_alpha_${tag}`;

  // Notice: Media 1 title is "Zebra Film" (saved sortOrder: 1)
  // Media 2 title is "Alpha Film" (saved sortOrder: 2)
  await db.insert(mediaItems).values({
    id: testMediaId1,
    mediaType: "movie",
    title: `Zebra Film (${tag})`,
    releaseDate: "2024-01-01",
    overview: "A thrilling tale of Zebras.",
  });
  await db.insert(mediaItems).values({
    id: testMediaId2,
    mediaType: "movie",
    title: `Alpha Film (${tag})`,
    releaseDate: "2023-01-01",
    overview: "The initial starting point.",
  });

  testCollectionId = `col_rb_${tag}`;
  await db.insert(collections).values({
    id: testCollectionId,
    userId: authorId,
    title: `Tier Ordering Test Collection (${tag})`,
    collectionType: "custom",
    visibility: "public",
    isPublic: true,
  });

  // Assign both entries with explicit saved sortOrder:
  // Entry 1: Zebra Film (sortOrder: 1)
  // Entry 2: Alpha Film (sortOrder: 2)
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

  // Give Media 1 an existing rating with thoughts & personal notes
  await db.insert(ratings).values({
    id: `rate1_${tag}`,
    collectionId: testCollectionId,
    mediaItemId: testMediaId1,
    userId: authorId,
    reviewText: "Outstanding cinematic direction.",
    personalNotes: "Extremely private personal note.",
    shareCommentary: false,
    calculatedOverallScore: 9.5,
    sourceRating: 9.5,
  });

  // Give Media 2 an existing rating with ONLY personalNotes (empty reviewText)
  await db.insert(ratings).values({
    id: `rate2_${tag}`,
    collectionId: testCollectionId,
    mediaItemId: testMediaId2,
    userId: authorId,
    reviewText: null,
    personalNotes: "Top secret diary note: must not leak into review.",
    shareCommentary: false,
    calculatedOverallScore: 8.0,
    sourceRating: 8.0,
  });

  // 3. Start Next.js test server
  await startServer();

  // 4. Launch browser tests
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: authorCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // BLOCKER 1: Explicit publication consent
    // -------------------------------------------------------------
    console.log("3. Testing Blocker 1: Explicit publication consent in ReviewEditorDialog...");

    // Go to collection page
    await page.goto(`${BASE_URL}/collection/${testCollectionId}`, { waitUntil: "networkidle" });
    console.log("Navigated to:", page.url());
    console.log("Page title:", await page.title());
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "stage30-debug-collection.png") });

    // Open RatingDialog for Zebra Film
    const rateBtn = page.locator("button:has-text('Edit Rating'), button:has-text('Edit'), button:has-text('Rate')").first();
    await rateBtn.click();
    await page.waitForSelector("[role='dialog']");

    // Click "Publish as Review"
    const publishAsReviewBtn = page.locator("button:has-text('Publish as Review')").first();
    await publishAsReviewBtn.click();
    await page.waitForTimeout(500);

    // Verify ReviewEditorDialog is open
    const reviewDialogTitle = page.locator("h2:has-text('Write a Review')");
    assert.ok(await reviewDialogTitle.isVisible(), "ReviewEditorDialog must be open");

    // A. Verify checkbox is UNCHECKED by default even when candidate rating exists
    const attachRatingCheckbox = page.locator("input[type='checkbox']:near(:text('Include rating with this review'))").first();
    const isCheckedDefault = await attachRatingCheckbox.isChecked();
    assert.equal(isCheckedDefault, false, "Include rating with this review MUST be unchecked by default for new review");
    console.log("✔ New review defaults 'Include rating with this review' to unchecked.");

    // B. Verify disclosure notice explains rating remains private
    const privateNotice = page.locator("text=Your rating will remain private to your ranking and will not be disclosed on this review.");
    assert.ok(await privateNotice.isVisible(), "Private rating notice must be displayed when unchecked");

    // C. Verify toggling checkbox updates disclosure
    await attachRatingCheckbox.check();
    await page.waitForTimeout(200);
    const publicNotice = page.locator("text=Your rating will be publicly visible alongside this review.");
    assert.ok(await publicNotice.isVisible(), "Public visibility notice must be displayed when checked");
    // Uncheck again to verify publishing without attached rating
    await attachRatingCheckbox.uncheck();
    await page.waitForTimeout(200);

    // Content is prefilled from Thoughts ("Outstanding cinematic direction.")
    const reviewContentTextarea = page.locator("textarea[placeholder*='Write your thoughts']").first();
    const prefilledThoughts = await reviewContentTextarea.inputValue();
    assert.ok(prefilledThoughts.includes("Outstanding cinematic direction"), "Thoughts text is prefilled");

    // Publish review with unchecked rating
    const publishReviewBtn = page.locator("button:has-text('Publish Review')").first();
    await publishReviewBtn.click();
    await page.waitForTimeout(1000);

    // Verify in database that created review has ratingId: null
    const createdReview = await db.query.reviews.findFirst({
      where: and(eq(reviews.userId, authorId), eq(reviews.mediaItemId, testMediaId1)),
    });
    assert.ok(createdReview, "Published review must be saved in database");
    assert.equal(createdReview.ratingId, null, "Rating must NOT be attached when checkbox was left unchecked");
    console.log("✔ Created review did not attach candidate rating (ratingId is null).");

    // Close rating dialog if still open
    const cancelRatingBtn1 = page.locator("button:has-text('Cancel')").first();
    if (await cancelRatingBtn1.isVisible()) {
      await cancelRatingBtn1.click();
      await page.waitForTimeout(400);
    }

    // D. Verify RatingDialog: when Thoughts is empty and only personalNotes exists,
    // Publish as Review does NOT substitute personalNotes
    console.log("4. Verifying Publish as Review does not substitute personalNotes when Thoughts is empty...");
    const editAlphaRatingBtn = page.locator("button:has-text('Edit Rating'), button:has-text('Edit'), button:has-text('Rate')").nth(1);
    await editAlphaRatingBtn.click();
    await page.waitForSelector("[role='dialog']");

    // Click "Publish as Review"
    const publishAsReviewBtn2 = page.locator("button:has-text('Publish as Review')").first();
    await publishAsReviewBtn2.click();
    await page.waitForTimeout(500);

    // Verify that review content in ReviewEditorDialog is EMPTY and NOT filled with personalNotes!
    const reviewContentInDialog = page.locator("textarea[placeholder*='Write your thoughts']").first();
    const prefilledValue = await reviewContentInDialog.inputValue();
    assert.equal(prefilledValue, "", "Must not substitute personalNotes when reviewText is empty");
    console.log("✔ 'Publish as Review' did not substitute private personal notes when Thoughts was empty.");

    // Close review dialog and rating dialog
    const cancelModalBtn = page.locator("button:has-text('Cancel')").last();
    await cancelModalBtn.click();
    await page.waitForTimeout(400);
    const cancelRatingModalBtn = page.locator("button:has-text('Cancel')").first();
    await cancelRatingModalBtn.click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // BLOCKER 2: Tier Board ordering unaffected by List/Grid sort
    // -------------------------------------------------------------
    console.log("5. Testing Blocker 2: Tier Board ordering immunity to List/Grid sorting...");

    // Switch collection to tier mode
    await fetch(`${BASE_URL}/api/collections/${testCollectionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `better-auth.session_token=${authorCookie}`,
      },
      body: JSON.stringify({ ratingMethod: "tier" }),
    });

    // Assign both items to Tier S in the tier collection
    await db.update(ratings).set({ tierId: "tier_std_s" }).where(eq(ratings.collectionId, testCollectionId));

    // Reload collection in tier mode
    await page.goto(`${BASE_URL}/collection/${testCollectionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Switch to List view
    const listBtn = page.locator("button[title='List view']").first();
    await listBtn.click();
    await page.waitForTimeout(400);

    // In List view, change sort dropdown to Alphabetical ("title")
    const sortDropdown = page.locator("select").first();
    await sortDropdown.selectOption("title");
    await page.waitForTimeout(500);

    // In List view sorted alphabetically:
    // First item is "Alpha Film" (Media 2) and second is "Zebra Film" (Media 1)
    const listFirstItem = page.locator("main .divide-y > div").nth(0);
    const listSecondItem = page.locator("main .divide-y > div").nth(1);
    assert.ok(await listFirstItem.locator(`text=Alpha Film (${tag})`).isVisible(), "List view sorted alphabetically has Alpha Film first");
    assert.ok(await listSecondItem.locator(`text=Zebra Film (${tag})`).isVisible(), "List view sorted alphabetically has Zebra Film second");
    console.log("✔ List view correctly applies alphabetical sort (Alpha Film, then Zebra Film).");

    // Now switch view mode to Tier Board ("Tier Board view")
    const tierBoardBtn = page.locator("button[title='Tier Board view']").first();
    await tierBoardBtn.click();
    await page.waitForTimeout(600);

    // Capture screenshot of Tier Board
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "stage30-tier-board-ordering-verified.png") });

    // In Tier Board view:
    // Both items are in Tier S.
    // The items inside Tier S lane MUST be ordered by saved sortOrder:
    // Entry 1 has Zebra Film (sortOrder: 1)
    // Entry 2 has Alpha Film (sortOrder: 2)
    // So Zebra Film MUST be first, and Alpha Film MUST be second,
    // despite the user previously selecting alphabetical sort in List view!
    const tierSContainer = page.locator(".space-y-4 > div").first(); // First tier row (Tier S)
    const cardTitles = await tierSContainer.locator(".truncate").allInnerTexts();

    assert.equal(cardTitles[0], `Zebra Film (${tag})`.toUpperCase(), "First card in Tier S must be Zebra Film (saved sortOrder: 1)");
    assert.equal(cardTitles[1], `Alpha Film (${tag})`.toUpperCase(), "Second card in Tier S must be Alpha Film (saved sortOrder: 2)");
    console.log(`✔ Tier Board card order strictly preserved saved order: [1: ${cardTitles[0]}, 2: ${cardTitles[1]}] despite List view having 'title' sort selected.`);

    console.log("\n🎉 ALL Phase 10 Final Release Blocker browser verification checks PASSED successfully!");
  } finally {
    await context.close();
    await browser.close();

    console.log("Cleaning up test database records...");
    await db.delete(reviews).where(eq(reviews.userId, authorId));
    await db.delete(ratings).where(eq(ratings.userId, authorId));
    await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, testCollectionId));
    await db.delete(collections).where(eq(collections.id, testCollectionId));
    await db.delete(mediaItems).where(eq(mediaItems.id, testMediaId1));
    await db.delete(mediaItems).where(eq(mediaItems.id, testMediaId2));
    await db.delete(user).where(eq(user.id, authorId));

    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Verification script failed:", err);
  if (serverProcess) (serverProcess as ChildProcess).kill("SIGTERM");
  process.exit(1);
});
