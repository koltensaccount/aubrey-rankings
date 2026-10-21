import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { checkIsAdmin } from "@/lib/admin";
import { db } from "@/db";
import { unresolvedImportItems } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { TEST_WORKSPACE_USER_ID } from "@/lib/test-workspace";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  const items = await db.query.unresolvedImportItems.findMany({
    where: eq(unresolvedImportItems.userId, TEST_WORKSPACE_USER_ID),
    orderBy: [desc(unresolvedImportItems.createdAt)],
    limit: 100,
  });

  return NextResponse.json({
    items,
  });
}
