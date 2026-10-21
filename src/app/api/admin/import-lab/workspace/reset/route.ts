import { NextRequest, NextResponse } from "next/server";
import {
  resetTestWorkspace,
  TEST_WORKSPACE_USER_ID,
  verifyAdminOrTestSession,
} from "@/lib/test-workspace";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "RESET_TEST_WORKSPACE") {
    return NextResponse.json(
      {
        error:
          'Confirmation phrase required. Please provide confirmation: "RESET_TEST_WORKSPACE".',
      },
      { status: 400 }
    );
  }

  try {
    const deleted = await resetTestWorkspace(TEST_WORKSPACE_USER_ID);
    return NextResponse.json({
      success: true,
      message: "Test workspace data successfully cleared.",
      deleted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to reset test workspace" },
      { status: 500 }
    );
  }
}
