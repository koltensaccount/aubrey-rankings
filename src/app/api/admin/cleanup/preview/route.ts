import { NextRequest, NextResponse } from "next/server";
import { calculateCleanupPreview } from "@/lib/library-cleanup";
import { verifyAdminOrTestSession } from "@/lib/test-workspace";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  // Preview targets the authenticated administrator's personal library
  const targetUserId = auth.adminUser?.id || auth.user?.id;
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Could not identify target administrator account." },
      { status: 400 }
    );
  }

  try {
    const preview = await calculateCleanupPreview(targetUserId);
    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to calculate cleanup preview" },
      { status: 500 }
    );
  }
}
