import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { sql } from "drizzle-orm";
import { validateUsername } from "@/lib/username";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const candidate = searchParams.get("username");

    if (!candidate) {
      return NextResponse.json(
        { available: false, reason: "Username is required." },
        { status: 400 }
      );
    }

    const validation = validateUsername(candidate);
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        { available: false, reason: validation.error },
        { status: 200 }
      );
    }

    const normalized = validation.normalized;

    // Check if taken in database (case-insensitive)
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`LOWER(${user.username}) = LOWER(${normalized})`)
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { available: false, reason: "This username is already taken." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { available: true, normalized, message: "Username is available!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Check Username Error]", error);
    return NextResponse.json(
      { available: false, reason: "Failed to verify username availability." },
      { status: 500 }
    );
  }
}
