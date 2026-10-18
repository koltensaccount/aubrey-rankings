import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserNotificationPreferences } from "@/lib/notifications";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await getUserNotificationPreferences(session.user.id);
  return NextResponse.json({ preferences: prefs });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const current = await getUserNotificationPreferences(session.user.id);

  const updated = {
    notifyFollows:
      typeof body.notifyFollows === "boolean"
        ? body.notifyFollows
        : current.notifyFollows,
    notifyLikes:
      typeof body.notifyLikes === "boolean"
        ? body.notifyLikes
        : current.notifyLikes,
    notifyComments:
      typeof body.notifyComments === "boolean"
        ? body.notifyComments
        : current.notifyComments,
    notifyTvReleases:
      typeof body.notifyTvReleases === "boolean"
        ? body.notifyTvReleases
        : current.notifyTvReleases,
    notifyMovieReleases:
      typeof body.notifyMovieReleases === "boolean"
        ? body.notifyMovieReleases
        : current.notifyMovieReleases,
    updatedAt: new Date(),
  };

  const existing = await db.query.notificationPreferences.findFirst({
    where: (p, { eq }) => eq(p.userId, session.user.id),
  });

  if (existing) {
    await db
      .update(notificationPreferences)
      .set(updated)
      .where(eq(notificationPreferences.userId, session.user.id));
  } else {
    await db.insert(notificationPreferences).values({
      userId: session.user.id,
      ...updated,
    });
  }

  return NextResponse.json({ preferences: updated });
}
