import { mutateRubric, RubricError } from "@/lib/rubric-management";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import {
  ratingSystems,
  ratingCategories,
  collections,
  categoryScores,
  ratings,
} from "@/db/schema";
import { nanoid } from "@/lib/utils";
import { eq, and, asc, not, inArray, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const system = await db.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) =>
        and(eq(rs.id, id), eq(rs.userId, session.user.id)),
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    if (!system) {
      return NextResponse.json(
        { error: "Rating system not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(system);
  } catch (error: any) {
    console.error("[Get Rating System Error]", error);
    return NextResponse.json(
      { error: "Failed to fetch rating system" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const ratingSystem = await mutateRubric(
      session.user.id,
      id,
      await request.json().catch(() => null),
    );
    return NextResponse.json({ success: true, ratingSystem });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RubricError
            ? error.message
            : "Failed to update rubric",
      },
      { status: error instanceof RubricError ? error.status : 500 },
    );
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await mutateRubric(session.user.id, id, null, true);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RubricError
            ? error.message
            : "Failed to delete rubric",
      },
      { status: error instanceof RubricError ? error.status : 500 },
    );
  }
}
