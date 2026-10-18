import { NextRequest, NextResponse } from "next/server";
import { checkNewReleases } from "@/lib/release-tracker";

export async function POST(request: NextRequest) {
  // Check authorization token
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const providedToken = bearerToken || cronSecretHeader;
  const expectedSecret =
    process.env.CRON_SECRET ||
    process.env.AUTO_UPDATE_TOKEN ||
    process.env.BETTER_AUTH_SECRET;

  if (
    process.env.NODE_ENV === "production" &&
    (!expectedSecret || providedToken !== expectedSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkNewReleases();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Release check failed:", err);
    return NextResponse.json(
      { error: "Release check failed", message: err?.message },
      { status: 500 }
    );
  }
}

// Allow GET for simple health / scheduler triggers if authorized
export async function GET(request: NextRequest) {
  return POST(request);
}
