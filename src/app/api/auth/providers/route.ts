import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_ID.trim() !== "" &&
      process.env.GOOGLE_CLIENT_SECRET.trim() !== ""
  );

  return NextResponse.json({
    google: googleConfigured,
  });
}
