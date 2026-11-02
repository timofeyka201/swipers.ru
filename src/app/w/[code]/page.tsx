import { redirect, notFound } from "next/navigation";
import { normalizeCode } from "@/lib/wish/types";
export default async function ShortWishlist({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  redirect("/wishlist/" + code);
}
