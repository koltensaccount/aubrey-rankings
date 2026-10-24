/** Explicit, idempotent maintenance; never called by a timeline read. */
import { db, pool } from "../src/db";
import { backfillUserActivityEvents } from "../src/lib/timeline-activity";
async function main() {
const userId = process.argv[2];
if (!userId) throw new Error("Usage: tsx scripts/reconcile-activity.ts <user-id> (set DATABASE_URL explicitly)");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be explicitly configured");
try {
  const owner = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  if (!owner) throw new Error("User not found");
  await db.transaction(async (tx) => {
    await backfillUserActivityEvents(userId, tx);
  });
  console.log("Activity reconciliation completed for", userId);
} finally { await pool.end(); }

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
