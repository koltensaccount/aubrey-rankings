import { Client } from "pg";
export const dynamic = "force-dynamic";
export async function GET() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 3000 });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM bug_reports LIMIT 0");
    return Response.json({ status: "ok", revision: process.env.APP_REVISION ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await client.end();
  }
}
