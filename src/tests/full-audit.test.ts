import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  user,
  collections,
  ratingSystems,
  ratingCategories,
  ratings,
  categoryScores,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { mutateRubric, validateRubric } from "../lib/rubric-management";
import {
  getCollectionTrackingStatus,
  setCollectionTracking,
} from "../lib/release-tracker";
import { getItemRatingStatus, getTopRankedEntries, getRatingSummary } from "../lib/scoring";
import { boundedJson, requireRateLimit } from "../lib/request-limits";
it("historical scores survive rubric edits, deletions and collection reassignment", async () => {
  const id = randomUUID(),
    owner = `audit-full-${id}`,
    rubric = `rubric-${id}`,
    cat = `category-${id}`,
    col = `col-${id}`;
  try {
    await db
      .insert(user)
      .values({ id: owner, email: `${owner}@example.com`, name: "Audit" });
    await db
      .insert(ratingSystems)
      .values({ id: rubric, userId: owner, name: "Original", scale: 10 });
    await db
      .insert(ratingCategories)
      .values({ id: cat, ratingSystemId: rubric, name: "Writing", weight: 3 });
    await db.insert(collections).values({
      id: col,
      userId: owner,
      title: "Private title",
      collectionType: "tv_show",
      tmdbId: 123,
      visibility: "private",
      defaultRatingSystemId: rubric,
    });
    // A collection assignment itself must not be silently changed by deleting a rubric.
    await assert.rejects(
      mutateRubric(owner, rubric, null, true),
      (e: any) => e.status === 409,
    );
    await assert.rejects(
      mutateRubric("other-user", rubric, { name: "Stolen" }),
      (e: any) => e.status === 404,
    );
    // Existing ratings are protected even if they currently contain no scores.
    await db.execute(
      (await import("drizzle-orm"))
        .sql`INSERT INTO media_items(id,media_type,title) VALUES (${id},'movie','Audit film')`,
    );
    await db.insert(ratings).values({
      id,
      userId: owner,
      mediaItemId: id,
      collectionId: col,
      ratingSystemId: rubric,
      calculatedOverallScore: 0,
    });
    await db.insert(categoryScores).values({
      id,
      ratingId: id,
      categoryId: cat,
      score: 0,
      weightApplied: 3,
    });
    for (const body of [
      { scale: 5 },
      { categories: [{ id: cat, name: "Writing", weight: 8 }] },
      { categories: [{ name: "New category", weight: 1 }] },
    ])
      await assert.rejects(
        mutateRubric(owner, rubric, body),
        (e: any) => e.status === 409,
      );
    const updated = await mutateRubric(owner, rubric, {
      name: "Renamed rubric",
    });
    assert.equal(updated?.name, "Renamed rubric");
    assert.equal(
      (
        await db.query.categoryScores.findFirst({
          where: (s, { eq }) => eq(s.id, id),
        })
      )?.score,
      0,
    );
    const historic = getItemRatingStatus(
      [{ id: "new", name: "Other", weight: 1, isRequired: true }],
      {
        calculatedOverallScore: 0,
        categoryScores: [{ categoryId: cat, score: 0 }],
        ratingSystem: {
          categories: [
            { id: cat, name: "Writing", weight: 3, isRequired: true },
          ],
        },
      },
    );
    assert.equal(historic.state, "rated");
    assert.equal(historic.score, 0);
    const hidden = await getCollectionTrackingStatus(col, "other-user");
    assert.equal(hidden.supported, false);
    assert.equal(hidden.targetTitle, null);
    await assert.rejects(
      setCollectionTracking(col, "other-user", true),
      /Collection not found/,
    );
  } finally {
    await db.delete(user).where(eq(user.id, owner));
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM media_items WHERE id=${id}`,
    );
  }
});
it("rubric validation rejects nonfinite weights, duplicates and invalid scales", () => {
  for (const body of [
    { name: "x", scale: -1, categories: [{ name: "x" }] },
    { name: "x", categories: [{ name: "x", weight: Infinity }] },
    {
      name: "x",
      categories: [
        { id: "x", name: "a" },
        { id: "x", name: "b" },
      ],
    },
  ])
    assert.throws(() => validateRubric(body, true));
});
it("report bodies are bounded even without Content-Length; JSON shapes and rate limits are enforced", async () => {
  await assert.rejects(
    boundedJson(
      new Request("http://localhost", {
        method: "POST",
        body: "x".repeat(100),
      }),
      10,
    ),
    (e: any) => e.status === 413,
  );
  await assert.rejects(
    boundedJson(
      new Request("http://localhost", { method: "POST", body: "null" }),
      100,
    ),
    (e: any) => e.status === 400,
  );
  const key = randomUUID();
  requireRateLimit(key, 1);
  assert.throws(
    () => requireRateLimit(key, 1),
    (e: any) => e.status === 429,
  );
});

it("imported source ratings are not mislabeled unrated", () => {
  const status = getItemRatingStatus([], {
    sourceRating: 0,
    sourceScale: 5,
    categoryScores: [],
  });
  assert.equal(status.state, "rated");
  assert.equal(status.score, 0);
  assert.equal(status.statusLabel, "★ 0.0/5");
});

it("historical weight snapshots are not reinterpreted after a legacy rubric edit",()=>{
 const status=getItemRatingStatus([{id:"a",name:"A",weight:9,isRequired:true},{id:"b",name:"B",weight:1,isRequired:true}],{categoryScores:[{categoryId:"a",score:0,weightApplied:1},{categoryId:"b",score:10,weightApplied:1}]});
 assert.equal(status.score,5);assert.equal(status.state,"rated");
});

it("ranking previews compare score scales without changing stored values",()=>{
const entries=[{mediaItemId:"native",sortOrder:0},{mediaItemId:"imported",sortOrder:1}];
const result=getTopRankedEntries(entries,[{mediaItemId:"native",calculatedOverallScore:7,ratingSystem:{scale:10}},{mediaItemId:"imported",sourceRating:4,sourceScale:5}]);
assert.equal(result[0].entry.mediaItemId,"imported");assert.equal(result[0].score,4);
});

it("profile summaries exclude watch-only records, preserve zero and respect score scales",()=>{
 assert.deepEqual(getRatingSummary([{calculatedOverallScore:null},{calculatedOverallScore:0},{sourceRating:4,sourceScale:5}]),{ratedCount:2,meanScore:"4.0"});
});
