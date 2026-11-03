"use client";
import { useState } from "react";
import Link from "next/link";
import PhotoGallery from "./PhotoGallery";
import { BuyButton } from "./Ui";
import ProductSheet from "./ProductSheet";
import { useStore } from "@/lib/store";
import { formatRub } from "@/lib/money";
import type { Product } from "@/lib/types";
export default function SharedProduct({ product: p }: { product: Product }) {
  const rates = useStore((s) => s.rates);
  const liked = useStore((s) => s.liked.some((x) => x.id === p.id));
  const [details, setDetails] = useState(false);
  return (
    <main className="ui-page">
      <div className="ui-friend-heading">
        <Link href="/" className="ui-mark">
          S
        </Link>
        <strong>Вам прислали товар из Swiper</strong>
      </div>
      <div className="ui-page-body">
        <PhotoGallery
          className="ui-shared-photo"
          images={p.images}
          title={p.title}
          eager
        />
        <strong className="ui-price">
          {formatRub(p.price, p.currency, rates)}
        </strong>
        <h1 className="ui-shared-title">
          <button onClick={() => setDetails(true)}>{p.title}</button>
        </h1>
        {p.rating !== undefined && (
          <p className="ui-rating">★ {p.rating.toFixed(1)}</p>
        )}
        <div className="ui-shared-actions">
          <BuyButton product={p} />
          <div>
            <button
              className="ui-btn ui-white"
              onClick={() =>
                liked
                  ? useStore.getState().unlike(p.id)
                  : useStore.getState().like(p)
              }
            >
              {liked ? "Сохранено" : "Сохранить"}
            </button>
            <Link
              className="ui-btn ui-dark"
              href={
                "/?q=" +
                encodeURIComponent(
                  p.category ?? p.title.split(" ").slice(0, 2).join(" "),
                )
              }
            >
              Похожее
            </Link>
          </div>
        </div>
      </div>
      <ProductSheet
        product={details ? p : null}
        onClose={() => setDetails(false)}
      />
    </main>
  );
}
