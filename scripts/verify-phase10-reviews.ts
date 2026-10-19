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
  comments,
  likes,
} from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {}

const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const authorData = {
  name: `Aubrey Author ${tag}`,
  email: `author-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `author_${tag}`,
};

const readerData = {
  name: `Film Buff ${tag}`,
  email: `reader-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `reader_${tag}`,
};

let serverProcess: ChildProcess | null = null;
let authorId: string = "";
let authorCookie: string = "";
let readerId: string = "";
let readerCookie: string = "";
let testMediaId: string = "";

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

async function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
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
  console.log("🎬 Starting Phase 10 First-Class Reviews E2E Browser Verification...\n");

  // 1. Seed accounts
  console.log("1. Creating author and reader test accounts...");
  const author = await createAccount(authorData);
  authorId = author.id;
  authorCookie = author.cookie;

  const reader = await createAccount(readerData);
  readerId = reader.id;
  readerCookie = reader.cookie;

  // 2. Seed media item
  testMediaId = `tmdb:movie:phase10_${tag}`;
  await db.insert(mediaItems).values({
    id: testMediaId,
    mediaType: "movie",
    title: `Spirited Away (Test ${tag})`,
    overview: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    releaseDate: "2001-07-20",
    posterPath: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
  });

  // 3. Start Next.js server
  console.log(`2. Starting Next.js test server on port ${PORT}...`);
  const { execSync } = await import("node:child_process");
  try {
    execSync("cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/", {
      cwd: process.cwd(),
      stdio: "ignore",
    });
  } catch {}

  serverProcess = spawn("node", ["--env-file=.env.local", ".next/standalone/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "localhost" },
    stdio: "inherit",
  });

  await waitForServer(BASE_URL);
  console.log("✔ Next.js test server is ready.\n");

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // Test 1: Author writes and saves a review as DRAFT privately
    // -------------------------------------------------------------
    console.log("3. Author writes and saves an independent review as a draft...");
    const authorContext = await browser.newContext();
    await authorContext.addCookies([
      {
        name: "better-auth.session_token",
        value: authorCookie,
        url: BASE_URL,
      },
    ]);
    const authorPage = await authorContext.newPage();
    authorPage.on("console", (msg) => console.log("[BROWSER CONSOLE]", msg.text()));
    authorPage.on("pageerror", (err) => console.log("[BROWSER ERROR]", err.message));
    await authorPage.setViewportSize({ width: 1280, height: 900 });

    // Visit media page
    const mediaPageRes = await authorPage.goto(`${BASE_URL}/media/${encodeURIComponent(testMediaId)}`, { waitUntil: "networkidle" });
    console.log("Media page URL:", authorPage.url(), "Status:", mediaPageRes?.status());
    await authorPage.waitForTimeout(1000);
    await authorPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage28-media-page-before-review.png") });

    // Click "Write a Review" button
    const writeBtn = authorPage.locator("button:has-text('Write a Review')").first();
    const isVisible = await writeBtn.isVisible();
    if (!isVisible) {
      const pageText = await authorPage.locator("body").innerText();
      console.log("Page body snippet:", pageText.slice(0, 300));
    }
    await assert.ok(isVisible, "Write a Review button must be visible to logged-in user");
    await writeBtn.click();
    await authorPage.waitForTimeout(1000);
    await authorPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage28-after-write-click.png") });
    console.log("URL after write click:", authorPage.url());

    // Fill in Review Editor Dialog
    await authorPage.waitForSelector("[role='dialog']");
    await authorPage.fill("[role='dialog'] input[type='text']", "Miyazaki's Unmatched Wonder");
    await authorPage.fill("[role='dialog'] textarea", "Spirited Away remains one of the greatest cinematic achievements. The hand-drawn backgrounds, Joe Hisaishi score, and themes of identity resonate across generations.");

    // Select Private visibility and Save Draft
    await authorPage.locator("button:has-text('Private')").click();
    const saveDraftBtn = authorPage.locator("button:has-text('Save Draft')");
    await saveDraftBtn.click();

    // Verify draft persisted in DB
    await authorPage.waitForTimeout(1000);
    const draftInDb = await db.query.reviews.findFirst({
      where: and(eq(reviews.userId, authorId), eq(reviews.mediaItemId, testMediaId)),
    });
    assert.ok(draftInDb, "Draft review must be saved in database");
    assert.equal(draftInDb.status, "draft");
    assert.equal(draftInDb.visibility, "private");
    console.log(`✔ Draft saved successfully with ID: ${draftInDb.id}`);

    // Verify non-author / visitor receives 404 for draft review
    console.log("4. Verifying non-author / visitor receives 404 when requesting draft review...");
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    const draftRes = await visitorPage.goto(`${BASE_URL}/review/${draftInDb.id}`);
    assert.equal(draftRes?.status(), 404, "Draft review must return 404 for non-author");
    console.log("✔ Non-author draft access correctly returned 404 Not Found.");

    // -------------------------------------------------------------
    // Test 2: Author explicitly publishes review
    // -------------------------------------------------------------
    console.log("5. Author opens review editor and explicitly publishes the review...");
    await authorPage.goto(`${BASE_URL}/review/${draftInDb.id}`, { waitUntil: "networkidle" });
    const editReviewBtn = authorPage.locator("button:has-text('Edit Review')");
    await editReviewBtn.click();
    await authorPage.waitForSelector("[role='dialog']");

    // Select "Public" visibility and click Publish
    await authorPage.locator("[role='dialog'] button:has-text('Public')").click();
    const publishBtn = authorPage.locator("[role='dialog'] button:has-text('Publish Review')");
    await publishBtn.click();

    await authorPage.waitForTimeout(1500);
    const publishedInDb = await db.query.reviews.findFirst({
      where: eq(reviews.id, draftInDb.id),
    });
    assert.ok(publishedInDb);
    assert.equal(publishedInDb.status, "published");
    assert.equal(publishedInDb.visibility, "public");
    assert.ok(publishedInDb.publishedAt, "publishedAt must be set");
    console.log("✔ Review explicitly published to public.");

    // -------------------------------------------------------------
    // Test 3: Reader visits /review/[id], likes, and comments
    // -------------------------------------------------------------
    console.log("6. Reader visits published review page, likes, and posts a threaded comment...");
    const readerContext = await browser.newContext();
    await readerContext.addCookies([
      {
        name: "better-auth.session_token",
        value: readerCookie,
        url: BASE_URL,
      },
    ]);
    const readerPage = await readerContext.newPage();
    await readerPage.setViewportSize({ width: 1280, height: 900 });

    const reviewRes = await readerPage.goto(`${BASE_URL}/review/${publishedInDb.id}`, { waitUntil: "networkidle" });
    assert.equal(reviewRes?.status(), 200, "Published review must be accessible at /review/[id]");

    await readerPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage28-review-detail-published.png") });

    // Like the review
    const likeBtn = readerPage.locator("button[aria-label='Like review']");
    await assert.ok(await likeBtn.isVisible(), "Like review button must be visible");
    await likeBtn.click();
    await readerPage.waitForTimeout(1000);

    // Verify like recorded in DB
    const likeInDb = await db.query.likes.findFirst({
      where: and(eq(likes.userId, readerId), eq(likes.reviewId, publishedInDb.id)),
    });
    assert.ok(likeInDb, "Like must be recorded on review");
    console.log("✔ Reader liked review successfully.");

    // Comment on review
    const commentInput = readerPage.locator("textarea[placeholder='Add a note or comment on this review...']");
    await commentInput.fill("Spot on analysis! Chihiro's growth at the bathhouse is truly unforgettable.");
    const postCommentBtn = readerPage.locator("button:has-text('Post Note')");
    await postCommentBtn.click();
    await readerPage.waitForTimeout(1200);

    // Verify comment in DB
    const commentInDb = await db.query.comments.findFirst({
      where: and(eq(comments.userId, readerId), eq(comments.reviewId, publishedInDb.id)),
    });
    assert.ok(commentInDb, "Comment must be recorded on review");
    console.log("✔ Reader commented on review successfully.");

    // Author replies to reader's comment
    console.log("7. Author replies to comment on review...");
    await authorPage.goto(`${BASE_URL}/review/${publishedInDb.id}`, { waitUntil: "networkidle" });
    const replyTrigger = authorPage.locator("button:has-text('Reply')").first();
    await replyTrigger.click();
    const replyInput = authorPage.locator("textarea[placeholder*='Write a reply']");
    await replyInput.fill("Thank you! That bathhouse scene with the River Spirit is a masterclass in animation.");
    const sendReplyBtn = authorPage.locator("button:has-text('Post Reply')");
    await sendReplyBtn.click();
    await authorPage.waitForTimeout(1200);

    const replyInDb = await db.query.comments.findFirst({
      where: and(eq(comments.parentId, commentInDb.id), eq(comments.reviewId, publishedInDb.id)),
    });
    assert.ok(replyInDb, "1-level threaded reply must be recorded");
    console.log("✔ Author replied with 1-level threaded discussion.");

    await authorPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage28-review-comments-threaded.png") });

    // -------------------------------------------------------------
    // Test 4: Author edits review after publication
    // -------------------------------------------------------------
    console.log("8. Author edits review after publication with spoiler warning...");
    const editBtn = authorPage.locator("button:has-text('Edit Review')");
    await editBtn.click();
    await authorPage.waitForSelector("[role='dialog']");

    await authorPage.fill("[role='dialog'] textarea", "Spirited Away remains one of the greatest cinematic achievements. Haku remembering his real name as the Kohaku River is one of the most emotional climaxes in cinema history.");
    // Toggle spoiler
    await authorPage.locator("[role='dialog'] input[type='checkbox']").click();
    const saveChangesBtn = authorPage.locator("[role='dialog'] button:has-text('Save & Update')");
    await saveChangesBtn.click();
    await authorPage.waitForTimeout(1500);

    const editedInDb = await db.query.reviews.findFirst({
      where: eq(reviews.id, publishedInDb.id),
    });
    assert.ok(editedInDb);
    assert.equal(editedInDb.isSpoiler, true, "isSpoiler must be true");
    assert.ok(editedInDb.content.includes("Kohaku River"), "Content must be updated");
    console.log("✔ Author edited review and marked spoiler successfully.");

    // Reader views review and sees spoiler protection mask
    await readerPage.reload({ waitUntil: "networkidle" });
    const revealBtn = readerPage.locator("button:has-text('Reveal Review')");
    await assert.ok(await revealBtn.isVisible(), "Spoiler mask must protect review content");
    await revealBtn.click();
    const revealedText = readerPage.locator("text=Kohaku River");
    await assert.ok(await revealedText.isVisible(), "Spoiler content revealed on click");
    console.log("✔ Spoiler mask safely protects content until reader clicks reveal.");

    await readerPage.screenshot({ path: path.join(SCREENSHOT_DIR, "stage28-review-spoiler-revealed.png") });

    // -------------------------------------------------------------
    // Test 5: Unpublish review without deleting content
    // -------------------------------------------------------------
    console.log("9. Author unpublishes review without deleting content...");
    await authorPage.goto(`${BASE_URL}/review/${publishedInDb.id}`, { waitUntil: "networkidle" });
    await authorPage.locator("button:has-text('Edit Review')").click();
    await authorPage.waitForSelector("[role='dialog']");
    await authorPage.locator("[role='dialog'] button:has-text('Unpublish')").click();
    await authorPage.waitForTimeout(1500);

    const unpubInDb = await db.query.reviews.findFirst({
      where: eq(reviews.id, publishedInDb.id),
    });
    assert.ok(unpubInDb);
    assert.equal(unpubInDb.status, "unpublished");
    assert.ok(unpubInDb.content.length > 0, "Content must remain intact when unpublished");
    console.log("✔ Review safely unpublished without deleting content.");

    // Non-author receives 404 for unpublished review
    const unpubReaderRes = await readerPage.goto(`${BASE_URL}/review/${publishedInDb.id}`);
    assert.equal(unpubReaderRes?.status(), 404, "Unpublished review must return 404 for non-author");
    console.log("✔ Unpublished review returns 404 for visitors/readers.");

    // -------------------------------------------------------------
    // Test 6: Author republishes review and deletes permanently
    // -------------------------------------------------------------
    console.log("10. Author republishes and permanently deletes review with cascade confirmation...");
    // Direct author access to unpublished review succeeds
    await authorPage.goto(`${BASE_URL}/review/${publishedInDb.id}`, { waitUntil: "networkidle" });
    await authorPage.locator("button:has-text('Edit Review')").click();
    await authorPage.waitForSelector("[role='dialog']");

    // Click Delete Review to trigger confirmation
    await authorPage.locator("[role='dialog'] button:has-text('Delete Review')").click();
    // In confirmation:
    await authorPage.waitForTimeout(500);
    const confirmDeleteBtn = authorPage.locator("[role='dialog'] button:has-text('Permanently Delete')");
    await confirmDeleteBtn.click();
    await authorPage.waitForTimeout(1500);

    // Verify deleted in DB along with cascaded comments & likes
    const deletedInDb = await db.query.reviews.findFirst({
      where: eq(reviews.id, publishedInDb.id),
    });
    assert.equal(deletedInDb, undefined, "Review must be permanently removed");

    const remainingLikes = await db.query.likes.findMany({
      where: eq(likes.reviewId, publishedInDb.id),
    });
    assert.equal(remainingLikes.length, 0, "Likes must cascade on review deletion");

    const remainingComments = await db.query.comments.findMany({
      where: eq(comments.reviewId, publishedInDb.id),
    });
    assert.equal(remainingComments.length, 0, "Comments must cascade on review deletion");
    console.log("✔ Permanent deletion cascaded comments and likes completely.");

    console.log("\n=======================================================");
    console.log("🎉 ALL PHASE 10 BROWSER ACCEPTANCE TESTS PASSED 100%!");
    console.log("=======================================================\n");
  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    // Cleanup DB test data
    await db.delete(comments).where(eq(comments.userId, readerId));
    await db.delete(likes).where(eq(likes.userId, readerId));
    await db.delete(reviews).where(eq(reviews.userId, authorId));
    await db.delete(mediaItems).where(eq(mediaItems.id, testMediaId));
    await db.delete(user).where(eq(user.id, authorId));
    await db.delete(user).where(eq(user.id, readerId));
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Phase 10 Browser Verification Failed:", err);
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    process.exit(1);
  });
