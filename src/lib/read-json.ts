export async function readJson(
  req: Request,
  max = 32768,
): Promise<Record<string, any>> {
  if (Number(req.headers.get("content-length")) > max)
    throw new Error("BODY_TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!result || Array.isArray(result) || typeof result !== "object")
    throw new Error("INVALID_BODY");
  return result;
}
