import { chromium } from "playwright";
import pg from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = "http://localhost:3100";
if (
  !process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw Error("Browser audit requires an isolated loopback database");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch:true,
});
const page = await context.newPage();
const tag = randomUUID().slice(0, 8),
  username = `audit${tag}`,
  email = `audit-browser-${tag}@example.com`,
  password = randomBytes(24).toString("base64url");
const output =
  process.env.AUDIT_SCREENSHOT_DIR || "/tmp/aubrey-audit-screenshots";
mkdirSync(output, { recursive: true });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let userId, collectionId;
const mediaIds = [];
async function api(path, method = "GET", data) {
  const response = await context.request.fetch(base + path, {
    method,
    data,
    headers: { Origin: base },
  });
  const result = await response.json();
  assert(
    response.ok(),
    `${path} ${response.status()} ${JSON.stringify(result)}`,
  );
  return result;
}
async function settle() {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);
}
try {
  const signup = await api("/api/auth/sign-up/email", "POST", {
    email,
    password,
    name: "Audit Curator",
  });
  userId = signup.user.id;
  await api("/api/user/profile", "PATCH", {
    username,
    preferredTheme: "dark",
    accentColor: "#F59E0B",
  });
  const system = (
    await db.query("SELECT id FROM rating_systems WHERE user_id=$1", [userId])
  ).rows[0];
  const cats = (
    await db.query(
      "SELECT id FROM rating_categories WHERE rating_system_id=$1 ORDER BY sort_order",
      [system.id],
    )
  ).rows;
  const col = await api("/api/collections", "POST", {
    title: "Black Mirror Episodes",
    collectionType: "custom",
  });
  collectionId = col.id;
  await api(`/api/collections/${collectionId}`, "PATCH", {
    visibility: "public",
    backdropImage: "/prototype-art/black-mirror-wall.jpg",
  });
  for (const [index, title] of [
    "San Junipero",
    "White Christmas",
    "The Entire History of You",
  ].entries()) {
    const id = `browser-${tag}-${index}`;
    mediaIds.push(id);
    await db.query(
      "INSERT INTO media_items(id,title,media_type,still_path,backdrop_path,poster_path) VALUES($1,$2,'episode',$3,$3,$3)",
      [
        id,
        title,
        [
          "/prototype-art/san-junipero.jpg",
          "/prototype-art/white-christmas.jpg",
          "/prototype-art/entire-history.jpg",
        ][index],
      ],
    );
    await db.query(
      "INSERT INTO collection_entries(id,collection_id,media_item_id,sort_order) VALUES($1,$2,$3,$4)",
      [id, collectionId, id, index],
    );
  }
  await api("/api/ratings", "POST", {
    collectionId,
    mediaItemId: mediaIds[0],
    ratingSystemId: system.id,
    scores: Object.fromEntries(cats.map((c) => [c.id, 0])),
  });
  await api("/api/ratings", "POST", {
    collectionId,
    mediaItemId: mediaIds[1],
    ratingSystemId: system.id,
    scores: { [cats[0].id]: 7 },
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const theme of ["dark", "light"]) {
      await api("/api/user/profile", "PATCH", { preferredTheme: theme });
      for (const [label, path] of [
        ["home", "/"],
        ["ranking", `/collection/${collectionId}`],
        ["profile", `/u/${username}`],
      ]) {
        await page.goto(base + path);
        await settle();
        assert.equal(
          await page.evaluate(() => document.documentElement.dataset.theme),
          theme,
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 2,
          ),
          `Horizontal overflow ${label} ${width}`,
        );
        await page.screenshot({
          path: `${output}/${label}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + `/collection/${collectionId}`);
  await settle();
  await page.getByRole("button", { name: "Rate", exact: true }).first().click();
  await page.getByRole("dialog").waitFor();
  const slider = page.getByRole("slider").first();
  assert.equal(
    await slider.getAttribute("aria-valuenow"),
    null,
    "unrated slider has no implicit score",
  );
  await slider.focus();
  await slider.press("Home");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0");
  await slider.press("ArrowRight");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
  await slider.press("Delete");
  assert.equal(await slider.getAttribute("aria-valuenow"), null);
  const box = await slider.boundingBox();
  assert(box);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
  assert.notEqual(await slider.getAttribute("aria-valuenow"), null);
  await page.screenshot({
    path: `output/rating-dialog.png`.replace("output", output),
    fullPage: true,
  });
  await page.setViewportSize({width:390,height:844});
  await slider.scrollIntoViewIfNeeded();
  const touchBox = await slider.boundingBox();
  await page.touchscreen.tap(touchBox.x+touchBox.width*.8,touchBox.y+touchBox.height/2);
  assert.notEqual(await slider.getAttribute("aria-valuenow"),null);
  await page.screenshot({path:`${output}/rating-dialog-mobile.png`,fullPage:true});
  await slider.press("Escape");
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Escape dismisses rating dialog",
  );
  for (const path of [
    "/prototype",
    "/prototype/ranking",
    "/prototype/profile",
  ]) {
    await page.goto(base + path);
    await settle();
    await page.screenshot({
      path: `${output}/${path.replaceAll("/", "-").slice(1)}.png`,
      fullPage: true,
    });
  }
  // Account switching must replace the old account's appearance in the same browser.
  await api("/api/auth/sign-out", "POST", {});
  await page.goto(base + "/");
  await settle();
  const second = await api("/api/auth/sign-up/email", "POST", {
    email: `audit-browser-b-${tag}@example.com`,
    password,
    name: "Second Audit",
  });
  try {
    await api("/api/user/profile", "PATCH", {
      preferredTheme: "dark",
      accentColor: "#89D5D5",
    });
    await page.goto(base + "/settings");
    await settle();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      "dark",
    );
    assert.notEqual(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--primary"),
      ),
      "#F59E0B",
    );
  } finally {
    await db.query('DELETE FROM "user" WHERE id=$1', [second.user.id]);
  }
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "PASS: desktop/mobile, light/dark home/ranking/profile; zero/unset/decimal slider keyboard and pointer interactions; Escape dismissal; prototype comparison; same-browser account appearance isolation",
  );
  console.log("Screenshots:", output);
} finally {
  if (userId) await db.query('DELETE FROM "user" WHERE id=$1', [userId]);
  if (mediaIds.length)
    await db.query("DELETE FROM media_items WHERE id=ANY($1::text[])", [
      mediaIds,
    ]);
  await browser.close();
  await db.end();
}
