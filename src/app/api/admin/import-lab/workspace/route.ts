import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import {
  ensureTestWorkspaceUser,
  getTestWorkspaceStats,
  TEST_WORKSPACE_USER_ID,
  TEST_WORKSPACE_EMAIL,
} from "@/lib/test-workspace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session || !checkIsAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  await ensureTestWorkspaceUser();
  const stats = await getTestWorkspaceStats();
  const isActive = session.user.id === TEST_WORKSPACE_USER_ID || Boolean((session.user as any).isTestWorkspace);

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
