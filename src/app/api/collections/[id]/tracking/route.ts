import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import {
  getCollectionTrackingStatus,
  setCollectionTracking,
} from "@/lib/release-tracker";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Collection ID required" }, { status: 400 });
  }

  const status = await getCollectionTrackingStatus(id, session?.user?.id);
  return NextResponse.json(status);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Collection ID required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  try {
    const updated = await setCollectionTracking(id, session.user.id, enabled);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update tracking settings" },
      { status: 400 }
    );
  }
}
