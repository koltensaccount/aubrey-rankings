import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { parseLetterboxdZip } from "@/lib/letterboxd";
import { executeLetterboxdImport } from "@/lib/letterboxd-import";
import { ensureTestWorkspaceUser, TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No archive file provided" }, { status: 400 });
    }

    await ensureTestWorkspaceUser();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const summary = parseLetterboxdZip(buffer);

    // Strictly executes into TEST_WORKSPACE_USER_ID
    const result = await executeLetterboxdImport(TEST_WORKSPACE_USER_ID, summary);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to execute import into test workspace" },
      { status: 500 }
    );
  }
}
