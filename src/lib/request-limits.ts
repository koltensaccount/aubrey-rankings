export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function boundedBytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RequestError("Request is too large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("A JSON object is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError("Request is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function boundedJson(request: Request, limit: number) {
  const bytes = await boundedBytes(request, limit);
  try {
    const data = JSON.parse(bytes.toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data;
  } catch {
    throw new RequestError("A JSON object is required");
  }
}
// A process-local backstop, with a global anonymous bucket so spoofed headers cannot bypass it.
const buckets = new Map<string, { start: number; count: number }>();
export function requireRateLimit(key: string, limit: number, windowMs = 60000) {
  const now = Date.now();
  for (const [k, v] of buckets)
    if (now - v.start >= windowMs) buckets.delete(k);
  const item = buckets.get(key) ?? { start: now, count: 0 };
  if (item.count >= limit || (!buckets.has(key) && buckets.size >= 10000))
    throw new RequestError("Too many requests. Please try again shortly.", 429);
  item.count++;
  buckets.set(key, item);
}

export async function boundedFormData(request: Request, limit: number) {
  const bytes = await boundedBytes(request, limit);
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(bytes),
    }).formData();
  } catch {
    throw new RequestError("Invalid image upload");
  }
}
