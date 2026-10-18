import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratingSystems, ratingCategories } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.id, id), eq(rs.userId, session.user.id)),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Rating system not found" }, { status: 404 });
    }

    const newSystemId = `rs_${Date.now()}_${nanoid(6)}`;

    await db.transaction(async (tx) => {
      await tx.insert(ratingSystems).values({
        id: newSystemId,
        userId: session.user.id,
        name: `Copy of ${source.name}`,
        description: source.description,
        scale: source.scale,
        isDefault: false,
      });

      for (const cat of source.categories) {
        await tx.insert(ratingCategories).values({
          id: `rc_${Date.now()}_${nanoid(6)}`,
          ratingSystemId: newSystemId,
          name: cat.name,
          description: cat.description,
          weight: cat.weight,
          sortOrder: cat.sortOrder,
          isRequired: cat.isRequired,
        });
      }
    });

    const created = await db.query.ratingSystems.findFirst({
      where: (rs, { eq }) => eq(rs.id, newSystemId),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    return NextResponse.json({ success: true, ratingSystem: created });
  } catch (error: any) {
    console.error("[Duplicate Rating System Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to duplicate rating system" },
      { status: 500 }
    );
  }
}
