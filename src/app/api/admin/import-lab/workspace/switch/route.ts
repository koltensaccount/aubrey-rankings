import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { session as sessionTable, user } from "@/db/schema";
import {
  ensureTestWorkspaceUser,
  TEST_WORKSPACE_USER_ID,
  verifyAdminOrTestSession,
} from "@/lib/test-workspace";
import { nanoid } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await verifyAdminOrTestSession(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized. Admin privileges required." },
      { status: auth.status || 403 }
    );
  }

  const cookieStore = await cookies();
  const currentToken =
    cookieStore.get("better-auth.session_token")?.value ||
    cookieStore.get("__Secure-better-auth.session_token")?.value;
  const adminReturnToken = cookieStore.get("aubrey_admin_session_token")?.value;

  const body = await request.json().catch(() => ({}));
  const targetActive = Boolean(body.active);

  const response = NextResponse.json({
    success: true,
    active: targetActive,
  });

  const isSecure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
  };

  if (targetActive) {
    // Switch TO test workspace
    await ensureTestWorkspaceUser();

    // Store admin token for safe return
    if (currentToken && !adminReturnToken) {
      response.cookies.set("aubrey_admin_session_token", currentToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Create a new session for test workspace user
    const testSessionToken = `test_ws_${nanoid(32)}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await db.insert(sessionTable).values({
      id: `sess_test_${nanoid(16)}`,
      userId: TEST_WORKSPACE_USER_ID,
      token: testSessionToken,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    response.cookies.set("better-auth.session_token", testSessionToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7,
    });
    if (isSecure) {
      response.cookies.set("__Secure-better-auth.session_token", testSessionToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  } else {
    // Switch BACK to Admin
    if (adminReturnToken) {
      response.cookies.set("better-auth.session_token", adminReturnToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7,
      });
      if (isSecure) {
        response.cookies.set("__Secure-better-auth.session_token", adminReturnToken, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      response.cookies.delete("aubrey_admin_session_token");
    }

    // Clean up current test workspace session row if it was a temporary test token
    if (currentToken && currentToken.startsWith("test_ws_")) {
      await db.delete(sessionTable).where(eq(sessionTable.token, currentToken));
    }
  }

  return response;
}
