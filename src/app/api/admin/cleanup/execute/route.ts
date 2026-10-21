import { NextRequest, NextResponse } from "next/server";
import { executeCleanup } from "@/lib/library-cleanup";
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

  const targetUserId = auth.adminUser?.id || auth.user?.id;
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Could not identify target administrator account." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { token, confirmationPhrase, dryRun = true } = body;
  const isDryRun = Boolean(dryRun);

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

  if (!isDryRun && auth.isTestWorkspace) {
    return NextResponse.json(
      {
        error:
          "Live cleanup execution requires switching back to your direct administrator account. Test workspace sessions are restricted to dry-run previews.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await executeCleanup(targetUserId, token, { dryRun: isDryRun });
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
