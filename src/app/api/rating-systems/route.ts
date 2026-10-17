import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { ratingSystems, ratingCategories } from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { eq, and, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const systems = await db.query.ratingSystems.findMany({
      where: (rs, { eq }) => eq(rs.userId, session.user.id),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    return NextResponse.json(systems);
  } catch (error: any) {
    console.error("[Get Rating Systems Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch rating systems" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, scale, isDefault, categories } = body;

    if (!name) {
      return NextResponse.json({ error: "System name is required" }, { status: 400 });
    }

    const systemId = `rs_${Date.now()}_${nanoid(6)}`;

    // If marked default, unset other defaults
    if (isDefault) {
      await db
        .update(ratingSystems)
        .set({ isDefault: false })
        .where(eq(ratingSystems.userId, session.user.id));
    }

    await db.insert(ratingSystems).values({
      id: systemId,
      userId: session.user.id,
      name: name.trim(),
      description: description || null,
      scale: scale || 10,
      isDefault: Boolean(isDefault),
    });

    if (Array.isArray(categories)) {
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        if (cat.name) {
          await db.insert(ratingCategories).values({
            id: `rc_${Date.now()}_${nanoid(6)}`,
            ratingSystemId: systemId,
            name: cat.name.trim(),
            description: cat.description || null,
            weight: typeof cat.weight === "number" ? cat.weight : 1.0,
            sortOrder: i + 1,
            isRequired: cat.isRequired !== false,
          });
        }
      }
    }

    return NextResponse.json({ id: systemId, success: true });
  } catch (error: any) {
    console.error("[Create Rating System Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create rating system" },
      { status: 500 }
    );
  }
}
