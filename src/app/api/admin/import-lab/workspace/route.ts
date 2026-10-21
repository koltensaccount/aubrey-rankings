import { NextRequest, NextResponse } from "next/server";
import {
  ensureTestWorkspaceUser,
  getTestWorkspaceStats,
  verifyAdminOrTestSession,
  TEST_WORKSPACE_USER_ID,
  TEST_WORKSPACE_EMAIL,
} from "@/lib/test-workspace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  await ensureTestWorkspaceUser();
  const stats = await getTestWorkspaceStats();
  const isActive = auth.isTestWorkspace;

  return NextResponse.json({
    workspace: {
      userId: TEST_WORKSPACE_USER_ID,
      email: TEST_WORKSPACE_EMAIL,
      name: "Import Lab Test Account",
      isActive,
      stats,
    },
  });
}
