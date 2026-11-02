import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productById } from "@/lib/catalog";
import { appUrl } from "@/lib/app-url";
import SharedProduct from "@/components/SharedProduct";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const p = productById((await params).id);
  if (!p) return { title: "Товар не найден — Swiper" };
  const base = await appUrl();
  return {
    title: p.title + " — Swiper",
    description: "Посмотрите товар и сохраните находку в Swiper.",
    openGraph: {
      title: p.title,
      type: "website",
      images: [
        {
          url: base + "/api/og/" + encodeURIComponent(p.id),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = productById((await params).id);
  if (!p) notFound();
  return <SharedProduct product={p} />;
}
