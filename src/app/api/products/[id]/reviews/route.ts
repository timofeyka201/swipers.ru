import { NextResponse } from "next/server";
import { productById } from "@/lib/catalog";
import { productReviewCount } from "@/lib/ae/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const product = productById(id);
  if (!product)
    return NextResponse.json({ error: "Нет такого товара" }, { status: 404 });
  const count = await productReviewCount(product);
  return NextResponse.json(
    { count: count ?? null },
    {
      headers: {
        "Cache-Control":
          count === undefined ? "no-store" : "public, max-age=3600",
      },
    },
  );
}
