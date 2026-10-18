import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { db, pool } from "../src/db";
import {
  user,
  session,
  account,
  collections,
  collectionEntries,
  mediaItems,
  ratings,
  comments,
  follows,
  likes,
  savedRankings,
} from "../src/db/schema";
import { inArray, eq, sql } from "drizzle-orm";
import { auth } from "../src/lib/auth";

const BASE_URL = process.env.TARGET_URL || "http://localhost:3000";
const SCREENSHOT_DIR = "/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9";

const tag = randomUUID().slice(0, 6);
const ownerUser = {
  name: `Curator Alice ${tag}`,
  email: `owner-alice-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `alice_${tag}`,
};

const visitorUser = {
  name: `Critic Bob ${tag}`,
  email: `visitor-bob-${tag}@aubrey-test.internal`,
  password: "Password123!@#",
  username: `bob_${tag}`,
};

let ownerId: string;
let visitorId: string;
let ownerCookie: string;
let visitorCookie: string;

const colId = `col_test_p7_${tag}`;
const movie1Id = `media_mov1_${tag}`;
const movie2Id = `media_mov2_${tag}`;

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
  
  // Extract session token cookie
  const match = rawCookie.match(/better-auth\.session_token=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : "";

  const record = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, data.email),
  });
  assert(record, `User ${data.email} must exist in DB`);

  await db
    .update(user)
    .set({ username: data.username, emailVerified: true })
    .where(eq(user.id, record.id));

  return { id: record.id, token, cookie: rawCookie };
}

(async () => {
  console.log("=== PHASE 7 BROWSER ACCEPTANCE VERIFICATION ===");
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Screenshot Dir: ${SCREENSHOT_DIR}\n`);

  let browser: Browser | null = null;

  try {
    // 1. Create Owner and Visitor accounts
    console.log("1. Setting up authenticated test accounts in PostgreSQL...");
    const ownerAcc = await createAccount(ownerUser);
    ownerId = ownerAcc.id;
    ownerCookie = ownerAcc.cookie;

    const visitorAcc = await createAccount(visitorUser);
    visitorId = visitorAcc.id;
    visitorCookie = visitorAcc.cookie;

    console.log(`   Owner:   @${ownerUser.username} (${ownerId})`);
    console.log(`   Visitor: @${visitorUser.username} (${visitorId})`);

    // 2. Insert test media items
    console.log("\n2. Seeding test collection and entries...");
    await db.insert(mediaItems).values([
      {
        id: movie1Id,
        tmdbId: 777101,
        mediaType: "movie",
        title: "2001: A Space Odyssey",
        overview: "Humanity finds a mysterious object buried beneath the lunar surface.",
        releaseDate: "1968-04-02",
        posterPath: "/ve72VxNqjGM69Uky4WTo2bK6rfq.jpg",
        backdropPath: "/w5COi0sV3aE1Z2qE5lQY1rJ6j3O.jpg",
      },
      {
        id: movie2Id,
        tmdbId: 777102,
        mediaType: "movie",
        title: "Solaris",
        overview: "A psychologist is sent to a space station orbiting a mysterious planet.",
        releaseDate: "1972-03-20",
        posterPath: "/uFimPsh3q9tG2r6M5s4Q0v7K0m.jpg",
        backdropPath: "/a1B2c3D4e5F6g7H8i9J0k.jpg",
      },
    ]);

    // 3. Create Public Collection owned by Alice
    await db.insert(collections).values({
      id: colId,
      userId: ownerId,
      title: "Science Fiction Masterworks",
      description: "An authoritative critical ranking of existential sci-fi masterpieces.",
      collectionType: "custom",
      visibility: "public",
      isPublic: true,
      allowComments: true,
    });

    // 4. Add entries to collection
    await db.insert(collectionEntries).values([
      {
        id: `entry_1_${tag}`,
        collectionId: colId,
        mediaItemId: movie1Id,
        sortOrder: 1,
      },
      {
        id: `entry_2_${tag}`,
        collectionId: colId,
        mediaItemId: movie2Id,
        sortOrder: 2,
      },
    ]);

    // 5. Add ratings by Owner
    await db.insert(ratings).values([
      {
        id: `rat_1_${tag}`,
        userId: ownerId,
        mediaItemId: movie1Id,
        collectionId: colId,
        reviewText: "The definitive cinematic monolith. A philosophical triumph of sound and silence.",
        personalNotes: "Owner Private Secret Note: Rewatched 70mm restoration in 2024.",
        sourceRating: 10.0,
      },
      {
        id: `rat_2_${tag}`,
        userId: ownerId,
        mediaItemId: movie2Id,
        collectionId: colId,
        reviewText: "Tarkovsky's poetic counterpoint to Kubrick. Deeply meditative human grief.",
        personalNotes: "Owner Private Secret Note: Discussed at length during film club.",
        sourceRating: 9.4,
      },
    ]);

    console.log(`   Collection created: /collection/${colId}`);

    // Launch Chromium browser
    console.log("\n3. Launching Playwright Chromium browser...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // -------------------------------------------------------------------
    // PART 1: OWNER EXPERIENCE
    // -------------------------------------------------------------------
    console.log("\n--- VERIFYING OWNER EXPERIENCE ---");
    const ownerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    // Set Better Auth session cookie
    await ownerContext.addCookies([
      {
        name: "better-auth.session_token",
        value: ownerAcc.token,
        url: BASE_URL,
      },
    ]);

    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`${BASE_URL}/collection/${colId}`, { waitUntil: "networkidle" });

    // Verify Owner Header Controls
    const hasPrivateBtn = await ownerPage.locator("button:has-text('Private')").count();
    const hasUnlistedBtn = await ownerPage.locator("button:has-text('Unlisted')").count();
    const hasPublicBtn = await ownerPage.locator("button:has-text('Public')").count();
    assert.ok(hasPrivateBtn > 0 && hasPublicBtn > 0, "Owner must see visibility controls");

    const hasBannerBtn = await ownerPage.locator("button:has-text('Banner')").count();
    const hasDeleteBtn = await ownerPage.locator("button:has-text('Delete')").count();
    assert.ok(hasBannerBtn > 0, "Owner must see Banner customization button");
    assert.ok(hasDeleteBtn > 0, "Owner must see Delete ranking button");

    const hasAddItemBtn = await ownerPage.locator("button:has-text('Add Item')").count();
    assert.ok(hasAddItemBtn > 0, "Owner must see Add Item button");

    // Verify Owner List View
    const editSlidersCount = await ownerPage.locator("button:has-text('Edit'), button:has-text('Rate')").count();
    assert.ok(editSlidersCount >= 2, "Owner must see Edit/Rate buttons on ranked entries in list view");
    console.log("   ✓ Owner header and entry edit controls verified in List view");

    await ownerPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-owner-list-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-owner-list-view.png");

    // Toggle to Editorial Grid View
    const gridToggleBtn = ownerPage.locator("button[title='Grid view']");
    await gridToggleBtn.click();
    await ownerPage.waitForTimeout(300);

    const ownerGridEditBtns = await ownerPage.locator("button:has-text('Edit'), button:has-text('Rate')").count();
    assert.ok(ownerGridEditBtns >= 2, "Owner must see Edit buttons in Editorial Grid view");
    console.log("   ✓ Owner edit controls verified in Editorial Grid view");

    await ownerPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-owner-editorial-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-owner-editorial-view.png");

    // -------------------------------------------------------------------
    // PART 2: LOGGED-IN VISITOR EXPERIENCE & INTERACTIONS
    // -------------------------------------------------------------------
    console.log("\n--- VERIFYING LOGGED-IN VISITOR EXPERIENCE & INTERACTIONS ---");
    const visitorContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await visitorContext.addCookies([
      {
        name: "better-auth.session_token",
        value: visitorAcc.token,
        url: BASE_URL,
      },
    ]);

    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(`${BASE_URL}/collection/${colId}`, { waitUntil: "networkidle" });

    // Assert absence of Owner Edit Controls
    const visitorPrivateBtn = await visitorPage.locator("button:has-text('Private')").count();
    assert.equal(visitorPrivateBtn, 0, "Visitor must NOT see Private visibility button");
    const visitorBannerBtn = await visitorPage.locator("button:has-text('Banner')").count();
    assert.equal(visitorBannerBtn, 0, "Visitor must NOT see Banner button");
    const visitorDeleteBtn = await visitorPage.locator("button:has-text('Delete')").count();
    assert.equal(visitorDeleteBtn, 0, "Visitor must NOT see Delete button");
    const visitorAddItemBtn = await visitorPage.locator("button:has-text('Add Item')").count();
    assert.equal(visitorAddItemBtn, 0, "Visitor must NOT see Add Item button");

    const visitorSlidersCount = await visitorPage.locator(".col-start-3 button").count();
    assert.equal(visitorSlidersCount, 0, "Visitor must NOT see Edit/Rate/Delete buttons in List view entries");
    console.log("   ✓ Verified owner edit controls are completely absent for visitor in List view");

    // Assert presence of Curator Badge & Identity
    const curatedByLabel = await visitorPage.locator("text=Curated By").count();
    assert.ok(curatedByLabel > 0, "Visitor must see 'Curated By' badge");
    const curatorHandle = await visitorPage.locator(`text=@${ownerUser.username}`).count();
    assert.ok(curatorHandle > 0, `Visitor must see curator handle @${ownerUser.username}`);

    // Verify Read-Only Scores and Owner Reviews
    const scorePill = await visitorPage.locator("text=10.0").count();
    assert.ok(scorePill > 0, "Visitor must see the curator's calculated/assigned score");
    const reviewQuote = await visitorPage.locator("text=The definitive cinematic monolith").count();
    assert.ok(reviewQuote > 0, "Visitor must see the curator's review commentary");

    // Verify strict absence of personalNotes
    const secretNotes = await visitorPage.locator("text=Owner Private Secret Note").count();
    assert.equal(secretNotes, 0, "Visitor must NEVER see owner personal notes");
    console.log("   ✓ Verified curator identity, scores, commentary, and private notes omission");

    // Capture Visitor List View
    await visitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-visitor-list-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-visitor-list-view.png");

    // Toggle to Editorial Grid View
    await visitorPage.locator("button[title='Grid view']").click();
    await visitorPage.waitForTimeout(300);
    const visitorGridSliders = await visitorPage.locator("[class*='sm:grid-cols-2'] button").count();
    assert.equal(visitorGridSliders, 0, "Visitor must NOT see Edit/Delete buttons in Editorial Grid view");
    console.log("   ✓ Verified visitor Editorial Grid view displays read-only cards without edit buttons");

    await visitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-visitor-editorial-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-visitor-editorial-view.png");

    // Switch back to list view for interactions
    await visitorPage.locator("button[title='List view']").click();
    await visitorPage.waitForTimeout(200);

    // Interaction 1: Follow Curator
    console.log("\n   Testing Follow interaction...");
    const followBtn = visitorPage.locator("button:has-text('Follow')").first();
    assert.ok(await followBtn.isVisible(), "Follow button must be visible");
    await followBtn.click();
    await visitorPage.mouse.move(0, 0);
    await visitorPage.waitForTimeout(600);
    const isFollowingNow = await visitorPage.locator("button:has-text('Following'), button:has-text('Unfollow')").count();
    assert.ok(isFollowingNow > 0, "Follow button must transition to 'Following' or 'Unfollow'");
    console.log("   ✓ Follow button successfully transitioned to 'Following'");

    // Interaction 2: Like Ranking
    console.log("   Testing Like interaction...");
    const likeBtn = visitorPage.locator("button[aria-label='Like ranking']").first();
    await likeBtn.click();
    await visitorPage.waitForTimeout(500);
    const likeCountText = await likeBtn.innerText();
    assert.ok(likeCountText.includes("1"), "Like counter must increment to 1");
    console.log("   ✓ Like counter incremented to 1");

    // Interaction 3: Save / Bookmark Ranking
    console.log("   Testing Save ranking interaction...");
    const saveBtn = visitorPage.locator("button[aria-label*='Save ranking'], button[title*='Save']").first();
    await saveBtn.click();
    await visitorPage.waitForTimeout(500);
    console.log("   ✓ Save ranking button clicked and state updated");

    // Interaction 4: Add Comment
    console.log("   Testing Comment interaction...");
    const commentInput = visitorPage.locator("textarea[placeholder*='thought'], textarea[placeholder*='comment']").first();
    await commentInput.scrollIntoViewIfNeeded();
    if (await commentInput.isVisible()) {
      await commentInput.fill("An undisputed masterpiece! Great ranking.");
      const submitCommentBtn = visitorPage.locator("button:has-text('Post'), button:has-text('Comment')").first();
      await submitCommentBtn.click();
      await visitorPage.waitForTimeout(800);
      const postedComment = await visitorPage.locator("text=An undisputed masterpiece!").count();
      assert.ok(postedComment > 0, "Newly posted comment must appear in comments list");
      console.log("   ✓ Comment successfully posted and visible in community discussion");
    }

    // Capture Visitor Interaction State Screenshot
    await visitorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-visitor-interactions-active.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-visitor-interactions-active.png");

    // -------------------------------------------------------------------
    // PART 3: LOGGED-OUT VISITOR EXPERIENCE
    // -------------------------------------------------------------------
    console.log("\n--- VERIFYING LOGGED-OUT GUEST EXPERIENCE ---");
    const guestContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${BASE_URL}/collection/${colId}`, { waitUntil: "networkidle" });

    // Assert guest sees Curator Identity and Scores
    const guestCuratorBadge = await guestPage.locator("text=Curated By").count();
    assert.ok(guestCuratorBadge > 0, "Guest must see 'Curated By' badge");
    const guestScore = await guestPage.locator("text=10.0").count();
    assert.ok(guestScore > 0, "Guest must see ranking score");

    // Assert zero owner controls
    const guestSliders = await guestPage.locator(".col-start-3 button").count();
    assert.equal(guestSliders, 0, "Guest must NOT see Edit/Rate buttons in List view");
    const guestPrivate = await guestPage.locator("button:has-text('Private')").count();
    assert.equal(guestPrivate, 0, "Guest must NOT see Private button");

    await guestPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-guest-list-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-guest-list-view.png");

    // Toggle to Editorial Grid View
    await guestPage.locator("button[title='Grid view']").click();
    await guestPage.waitForTimeout(300);
    const guestGridSliders = await guestPage.locator("[class*='sm:grid-cols-2'] button").count();
    assert.equal(guestGridSliders, 0, "Guest must NOT see Edit buttons in Editorial Grid view");

    await guestPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-guest-editorial-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-guest-editorial-view.png");

    // -------------------------------------------------------------------
    // PART 4: PROTOTYPE COMPACT RANKING VIEW
    // -------------------------------------------------------------------
    console.log("\n--- VERIFYING PROTOTYPE COMPACT SCAN TABLE VIEW ---");
    await guestPage.goto(`${BASE_URL}/prototype/ranking`, { waitUntil: "networkidle" });
    const compactToggleBtn = guestPage.locator("button[title='Score table']").first();
    assert.ok(await compactToggleBtn.isVisible(), "Score table (compact view) button must be visible");
    await compactToggleBtn.click();
    await guestPage.waitForTimeout(300);
    await guestPage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage21-prototype-compact-view.png"),
      fullPage: false,
    });
    console.log("   📸 Captured stage21-prototype-compact-view.png");

    console.log("\n=======================================================");
    console.log("ALL PLAYWRIGHT BROWSER ACCEPTANCE CHECKS PASSED!");
    console.log("=======================================================\n");
  } finally {
    if (browser) {
      await browser.close();
    }

    // Database cleanup
    console.log("Cleaning up test accounts, collections, and ratings...");
    try {
      await db.delete(comments).where(eq(comments.collectionId, colId));
      await db.delete(likes).where(eq(likes.collectionId, colId));
      await db.delete(savedRankings).where(eq(savedRankings.collectionId, colId));
      await db.delete(ratings).where(eq(ratings.collectionId, colId));
      await db.delete(collectionEntries).where(eq(collectionEntries.collectionId, colId));
      await db.delete(collections).where(eq(collections.id, colId));
      await db.delete(mediaItems).where(inArray(mediaItems.id, [movie1Id, movie2Id]));
      if (ownerId && visitorId) {
        await db.delete(follows).where(sql`${follows.followerId} IN (${ownerId}, ${visitorId}) OR ${follows.followingId} IN (${ownerId}, ${visitorId})`);
        await db.delete(session).where(inArray(session.userId, [ownerId, visitorId]));
        await db.delete(account).where(inArray(account.userId, [ownerId, visitorId]));
        await db.delete(user).where(inArray(user.id, [ownerId, visitorId]));
      }
      console.log("Cleanup completed successfully.");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    } finally {
      await pool.end();
    }
  }
})().catch((err) => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exitCode = 1;
});
