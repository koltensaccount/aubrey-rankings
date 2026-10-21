import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { resetTestWorkspace, TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const cookieStore = await cookies();
  const adminReturnToken = cookieStore.get("aubrey_admin_session_token")?.value;

  const isDirectAdmin = session && checkIsAdmin(session);
  const isInTestWorkspaceWithReturn =
    session?.user.id === TEST_WORKSPACE_USER_ID && Boolean(adminReturnToken);

  if (!isDirectAdmin && !isInTestWorkspaceWithReturn) {
    return NextResponse.json(
      { error: "Unauthorized. Admin privileges required." },
      { status: 403 }
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
