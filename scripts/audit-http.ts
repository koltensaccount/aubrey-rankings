import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import AdmZip from "adm-zip";
import { db, pool } from "../src/db";
import {
  user,
  mediaItems,
  collectionEntries,
  ratingSystems,
  ratingCategories,
  ratings,
  categoryScores,
  verification,
} from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

// Start a local production server against the same local database before running npm run test:http.
const base = process.env.AUDIT_HTTP_BASE_URL || "http://localhost:3100";
const loopback = ["localhost", "127.0.0.1", "[::1]"];
if (
  !loopback.includes(new URL(base).hostname) ||
  (process.env.DATABASE_URL &&
    !loopback.includes(new URL(process.env.DATABASE_URL).hostname))
) {
  throw new Error(
    "HTTP audit fixtures must only run against a loopback server and database.",
  );
}
const tag = randomUUID();
const emails = [
  `audit-http-a-${tag}@example.com`,
  `audit-http-b-${tag}@example.com`,
];
const password = randomBytes(24).toString("base64url");
const mediaId = `audit-http-${tag}`;
const verificationIds = [`audit-reset-${tag}`, `audit-expired-${tag}`];
async function call(path: string, method = "GET", body?: unknown, cookie = "") {
  const res = await fetch(base + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await res.json();
  return { res, data };
}
(async () => {
  try {
    const accounts = [];
    for (const email of emails) {
      const signup = await call("/api/auth/sign-up/email", "POST", {
        name: "Local Audit",
        email,
        password,
      });
      assert.equal(signup.res.status, 200, "signup");
      const cookie = signup.res.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert(cookie);
      accounts.push({ id: signup.data.user.id, cookie });
    }
    const [a, b] = accounts;
    assert.equal(
      (await call("/api/ratings", "POST", { mediaItemId: mediaId })).res.status,
      401,
    );
    const system = await db.query.ratingSystems.findFirst({
      where: (r, { eq }) => eq(r.userId, a.id),
      with: { categories: true },
    });
    const otherSystem = await db.query.ratingSystems.findFirst({
      where: (r, { eq }) => eq(r.userId, b.id),
      with: { categories: true },
    });
    assert(system && otherSystem);
    const c = system.categories;
    for (const title of ["   ", { invalid: true }])
      assert.equal(
        (
          await call(
            "/api/collections",
            "POST",
            { title, collectionType: "custom" },
            a.cookie,
          )
        ).res.status,
        400,
      );
    const col = await call(
      "/api/collections",
      "POST",
      { title: "Audit ranking", collectionType: "custom" },
      a.cookie,
    );
    assert.equal(col.res.status, 200);
    const colId = col.data.id;
    await db
      .insert(mediaItems)
      .values({ id: mediaId, title: "HTTP audit film", mediaType: "movie" });
    const entryId = `audit-entry-${tag}`;
    await db
      .insert(collectionEntries)
      .values({ id: entryId, collectionId: colId, mediaItemId: mediaId });
    const payload = {
      mediaItemId: mediaId,
      collectionId: colId,
      ratingSystemId: system.id,
      categoryScores: [
        { categoryId: c[0].id, score: 8 },
        { categoryId: c[1].id, score: 9 },
      ],
      reviewText: "preserve this review",
      isFavorite: true,
      watchDate: "2026-01-01T00:00:00.000Z",
    };
    let saved = await call("/api/ratings", "POST", payload, a.cookie);
    assert.equal(saved.res.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.rating.categoryScores.length, 2);
    let detail = await call(
      "/api/collections/" + colId,
      "GET",
      undefined,
      a.cookie,
    );
    assert.equal(
      detail.data.ratings[0].categoryScores.length,
      2,
      "array scores persist on reload",
    );
    const simultaneous = await Promise.all([
      call(
        "/api/ratings",
        "POST",
        { mediaItemId: mediaId, collectionId: colId, scores: { [c[0].id]: 6 } },
        a.cookie,
      ),
      call(
        "/api/ratings",
        "POST",
        { mediaItemId: mediaId, collectionId: colId, scores: { [c[1].id]: 7 } },
        a.cookie,
      ),
    ]);
    assert(simultaneous.every((r) => r.res.status === 200));
    detail = await call(
      "/api/collections/" + colId,
      "GET",
      undefined,
      a.cookie,
    );
    const persisted = Object.fromEntries(
      detail.data.ratings[0].categoryScores.map((r: any) => [
        r.categoryId,
        r.score,
      ]),
    );
    assert.equal(persisted[c[0].id], 6);
    assert.equal(persisted[c[1].id], 7);
    assert.equal(
      (await call("/api/collections/" + colId, "GET", undefined, b.cookie)).res
        .status,
      404,
    );
    saved = await call(
      "/api/ratings",
      "POST",
      {
        mediaItemId: mediaId,
        collectionId: colId,
        scores: { [c[0].id]: null },
      },
      a.cookie,
    );
    assert.equal(saved.data.rating.categoryScores.length, 1);
    assert.equal(saved.data.rating.reviewText, "preserve this review");
    assert.equal(saved.data.rating.isFavorite, true);
    assert.equal(
      (
        await call(
          "/api/ratings",
          "POST",
          {
            mediaItemId: mediaId,
            collectionId: colId,
            scores: { [otherSystem.categories[0].id]: 10 },
          },
          a.cookie,
        )
      ).res.status,
      400,
    );
    const switchedSystem = `audit-system-${tag}`,
      switchedCategory = `audit-category-${tag}`;
    await db
      .insert(ratingSystems)
      .values({
        id: switchedSystem,
        userId: a.id,
        name: "Alternate audit system",
        scale: 10,
      });
    await db
      .insert(ratingCategories)
      .values({
        id: switchedCategory,
        ratingSystemId: switchedSystem,
        name: "Alternate",
        weight: 1,
      });
    saved = await call(
      "/api/ratings",
      "POST",
      {
        mediaItemId: mediaId,
        collectionId: colId,
        ratingSystemId: switchedSystem,
        categoryScores: [{ categoryId: switchedCategory, score: 7 }],
        watchDate: null,
      },
      a.cookie,
    );
    assert.equal(saved.res.status, 200);
    assert.deepEqual(
      saved.data.rating.categoryScores.map((s: any) => s.categoryId),
      [switchedCategory],
    );
    assert.equal(saved.data.rating.watchDate, null);
    for (const [path, method, body] of [
      [`/api/ratings?ratingId=${saved.data.ratingId}`, "DELETE", undefined],
      [`/api/collections/${colId}/entries/${entryId}`, "DELETE", undefined],
      [`/api/collections/${colId}`, "DELETE", undefined],
    ] as const)
      assert.equal((await call(path, method, body, b.cookie)).res.status, 404);
    assert.equal(
      (
        await call(
          `/api/ratings?ratingId=${saved.data.ratingId}`,
          "DELETE",
          undefined,
          a.cookie,
        )
      ).res.status,
      200,
    );
    assert.equal(
      (
        await db.query.categoryScores.findMany({
          where: (s, { eq }) => eq(s.ratingId, saved.data.ratingId),
        })
      ).length,
      0,
    );
    await call("/api/ratings", "POST", payload, a.cookie);
    await call(
      "/api/ratings",
      "POST",
      {
        mediaItemId: mediaId,
        ratingSystemId: system.id,
        scores: { [c[0].id]: 8 },
      },
      a.cookie,
    );
    const otherRating = await call(
      "/api/ratings",
      "POST",
      {
        mediaItemId: mediaId,
        ratingSystemId: otherSystem.id,
        scores: { [otherSystem.categories[0].id]: 6 },
      },
      b.cookie,
    );
    assert.equal(otherRating.res.status, 200);
    assert.equal(
      (
        await call(
          `/api/collections/${colId}/entries/${entryId}`,
          "DELETE",
          undefined,
          a.cookie,
        )
      ).res.status,
      200,
    );
    assert.equal(
      (
        await db.query.ratings.findMany({
          where: (r, { eq }) => eq(r.collectionId, colId),
        })
      ).length,
      0,
    );
    assert(
      await db.query.ratings.findFirst({
        where: (r, { and, eq, isNull }) =>
          and(
            eq(r.userId, a.id),
            eq(r.mediaItemId, mediaId),
            isNull(r.collectionId),
          ),
      }),
    );
    await db
      .insert(collectionEntries)
      .values({ id: entryId, collectionId: colId, mediaItemId: mediaId });
    await call("/api/ratings", "POST", payload, a.cookie);
    assert.equal(
      (await call(`/api/collections/${colId}`, "DELETE", undefined, a.cookie))
        .res.status,
      200,
    );
    assert.equal(
      (
        await db.query.ratings.findMany({
          where: (r, { eq }) => eq(r.collectionId, colId),
        })
      ).length,
      0,
    );
    assert(
      await db.query.mediaItems.findFirst({
        where: (m, { eq }) => eq(m.id, mediaId),
      }),
    );
    assert(
      await db.query.ratings.findFirst({
        where: (r, { eq }) => eq(r.id, otherRating.data.ratingId),
      }),
    );
    const zip = new AdmZip();
    zip.addFile(
      "ratings.csv",
      Buffer.from(
        `Name,Year,Letterboxd URI,Rating\nAudit remake ${tag},1972,audit-1972,4.5\nAudit remake ${tag},2002,audit-2002,4\n`,
      ),
    );
    function form() {
      const f = new FormData();
      f.set(
        "file",
        new File([Uint8Array.from(zip.toBuffer())], "letterboxd.zip", {
          type: "application/zip",
        }),
      );
      return f;
    }
    let preview = await call(
      "/api/import/letterboxd/preview",
      "POST",
      form(),
      a.cookie,
    );
    assert.equal(preview.res.status, 200);
    assert.equal(preview.data.newCount, 2);
    const executed = await call(
      "/api/import/letterboxd/execute",
      "POST",
      form(),
      a.cookie,
    );
    assert.equal(executed.res.status, 200, JSON.stringify(executed.data));
    assert.equal(executed.data.newCount, 2);
    preview = await call(
      "/api/import/letterboxd/preview",
      "POST",
      form(),
      a.cookie,
    );
    assert.equal(preview.data.existingCount, 2);
    const bad = new FormData();
    bad.set("file", "not a file");
    assert.equal(
      (await call("/api/import/letterboxd/preview", "POST", bad, a.cookie)).res
        .status,
      400,
    );
    assert.equal(
      (
        await call("/api/auth/reset-password", "POST", {
          token: "audit-invalid-token",
          newPassword: password,
        })
      ).res.status,
      400,
    );
    const newPassword = randomBytes(24).toString("base64url");
    assert.equal(
      (
        await call(
          "/api/auth/change-password",
          "POST",
          { currentPassword: password, newPassword, revokeOtherSessions: true },
          a.cookie,
        )
      ).res.status,
      200,
    );
    assert.equal(
      (
        await call("/api/auth/sign-in/email", "POST", {
          email: emails[0],
          password,
        })
      ).res.status,
      401,
    );
    assert.equal(
      (
        await call("/api/auth/sign-in/email", "POST", {
          email: emails[0],
          password: newPassword,
        })
      ).res.status,
      200,
    );
    const resetToken = randomBytes(24).toString("hex"),
      resetPassword = randomBytes(24).toString("base64url");
    await db
      .insert(verification)
      .values({
        id: verificationIds[0],
        identifier: `reset-password:${resetToken}`,
        value: a.id,
        expiresAt: new Date(Date.now() + 60000),
      });
    assert.equal(
      (
        await call("/api/auth/reset-password", "POST", {
          token: resetToken,
          newPassword: resetPassword,
        })
      ).res.status,
      200,
    );
    assert.equal(
      (
        await call("/api/auth/reset-password", "POST", {
          token: resetToken,
          newPassword: resetPassword,
        })
      ).res.status,
      400,
    );
    assert.equal(
      (await call("/api/auth/get-session", "GET", undefined, a.cookie)).data,
      null,
      "password reset revokes old sessions",
    );
    assert.equal(
      (
        await call("/api/auth/sign-in/email", "POST", {
          email: emails[0],
          password: resetPassword,
        })
      ).res.status,
      200,
    );
    const expiredToken = randomBytes(24).toString("hex");
    await db
      .insert(verification)
      .values({
        id: verificationIds[1],
        identifier: `reset-password:${expiredToken}`,
        value: a.id,
        expiresAt: new Date(Date.now() - 60000),
      });
    assert.equal(
      (
        await call("/api/auth/reset-password", "POST", {
          token: expiredToken,
          newPassword: resetPassword,
        })
      ).res.status,
      400,
    );
    console.log(
      "PASS: built production HTTP app — signup, authentication, ownership, array-score persistence/reload, clearing scores, system switching, dates, rating/entry/collection deletion and cascades, shared-media/global-rating isolation, ZIP preview/execute and remake identity, invalid/expired/reused reset tokens, password change, reset session revocation, and sign-in.",
    );
  } finally {
    const fixtures = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, emails));
    const ids = fixtures.map((row) => row.id);
    const owned = ids.length
      ? await db.query.ratings.findMany({
          where: (r, { inArray }) => inArray(r.userId, ids),
          columns: { mediaItemId: true },
        })
      : [];
    await db
      .delete(verification)
      .where(inArray(verification.id, verificationIds));
    await db.delete(user).where(inArray(user.email, emails));
    await db
      .delete(mediaItems)
      .where(
        inArray(mediaItems.id, [
          mediaId,
          ...owned.map((row) => row.mediaItemId),
        ]),
      );
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
