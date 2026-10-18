import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    path.length < 1 ||
    path.length > 2 ||
    (path.length === 2 && !["avatars", "backdrops"].includes(path[0])) ||
    !/^[A-Za-z0-9_-]+\.webp$/.test(path.at(-1)!)
  )
    return new Response(null, { status: 404 });
  try {
    const data = await readFile(
      join(process.cwd(), "public", "uploads", ...path),
    );
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
