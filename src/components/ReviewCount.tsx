"use client";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { baseId } from "@/lib/ids";
import { compact, plural } from "@/lib/money";

const requests = new Map<string, Promise<number | null>>();
export default function ReviewCount({ product }: { product: Product }) {
  const id = baseId(product.id);
  const [loaded, setLoaded] = useState<{ id: string; count: number | null }>();
  useEffect(() => {
    if (product.reviewsCount !== undefined || product.source !== "ae") return;
    let alive = true;
    let request = requests.get(id);
    if (!request) {
      request = fetch("/api/products/" + encodeURIComponent(id) + "/reviews")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          typeof d?.count === "number" &&
          Number.isSafeInteger(d.count) &&
          d.count >= 0
            ? d.count
            : null,
        )
        .catch(() => null);
      if (requests.size >= 200) requests.delete(requests.keys().next().value!);
      requests.set(id, request);
    }
    void request.then((count) => {
      if (alive) setLoaded({ id, count });
    });
    return () => {
      alive = false;
    };
  }, [id, product.reviewsCount, product.source]);
  const count =
    product.reviewsCount ?? (loaded?.id === id ? loaded.count : null);
  return (
    <span>
      {count == null
        ? "Отзывы —"
        : compact(count) +
          " " +
          (count >= 1000
            ? "отзывов"
            : plural(count, "отзыв", "отзыва", "отзывов"))}
    </span>
  );
}
