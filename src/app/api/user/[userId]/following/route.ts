import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { getFollowingList } from "@/lib/social-queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession();
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const result = await getFollowingList(userId, session?.user?.id);
  return NextResponse.json(result);
}
