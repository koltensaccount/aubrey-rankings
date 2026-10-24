import assert from "node:assert/strict";
import { it } from "node:test";
import { formatReviewDate } from "../lib/review-date";

for (const timeZone of ["America/Chicago", "UTC"]) {
  it(`preserves verified calendar dates and localizes native timestamps in ${timeZone}`, () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = timeZone;
      assert.equal(new Intl.DateTimeFormat().resolvedOptions().timeZone, timeZone);
      assert.equal(formatReviewDate("2024-01-02"), "January 2, 2024");
      assert.equal(formatReviewDate("2024-07-02"), "July 2, 2024");
      assert.equal(formatReviewDate("2024-02-29"), "February 29, 2024");
      const localTimestampDay = timeZone === "America/Chicago" ? "January 1, 2024" : "January 2, 2024";
      assert.equal(formatReviewDate("2024-01-02T00:00:00.000Z"), localTimestampDay);
      assert.equal(formatReviewDate(new Date("2024-01-02T00:00:00.000Z")), localTimestampDay);
      assert.equal(formatReviewDate(null), null);
      assert.equal(formatReviewDate(undefined), null);
      assert.equal(formatReviewDate("2024-02-30"), null);
      assert.equal(formatReviewDate("invalid"), null);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}
