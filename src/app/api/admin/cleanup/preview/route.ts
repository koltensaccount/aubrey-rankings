import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { calculateCleanupPreview } from "@/lib/library-cleanup";
import { TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
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

  try {
    const preview = await calculateCleanupPreview(session.user.id);
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
