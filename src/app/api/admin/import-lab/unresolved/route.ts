import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { unresolvedImportItems } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  TEST_WORKSPACE_USER_ID,
  verifyAdminOrTestSession,
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

  const items = await db.query.unresolvedImportItems.findMany({
    where: eq(unresolvedImportItems.userId, TEST_WORKSPACE_USER_ID),
    orderBy: [desc(unresolvedImportItems.createdAt)],
    limit: 100,
  });

  return NextResponse.json({
    items,
  });
}
