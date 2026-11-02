/** Only service state is stored here. Real names, phone and measurements are discarded. */
export function cleanProfile(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of [
    "liked",
    "wishlist",
    "cart",
    "taste",
    "orders",
    "watch",
    "rejected",
    "stats",
    "tasted",
    "updatedAt",
  ])
    if (input[key] !== undefined) out[key] = input[key];
  for (const key of ["liked", "wishlist", "cart", "orders", "rejected"])
    if (out[key] !== undefined && !Array.isArray(out[key]))
      throw new Error("INVALID_PROFILE");
  return out;
}
