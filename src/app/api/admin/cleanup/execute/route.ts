import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { executeCleanup } from "@/lib/library-cleanup";
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

  const body = await request.json().catch(() => ({}));
  const { token, confirmationPhrase, dryRun = true } = body;

  if (confirmationPhrase !== "PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY") {
    return NextResponse.json(
      {
        error:
          'Exact confirmation phrase required: "PERMANENTLY_CLEAN_MY_LETTERBOXD_HISTORY".',
      },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Valid confirmation token is required." },
      { status: 400 }
    );
  }

  try {
    const result = await executeCleanup(session.user.id, token, { dryRun: Boolean(dryRun) });
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to execute library cleanup" },
      { status: 400 }
    );
  }
}
