"use client";
import Link from "next/link";
import { useStore, useHydrated } from "@/lib/store";
import Img from "@/components/Img";
import { shopUrl } from "@/lib/shop";
import { formatRub } from "@/lib/money";
export default function Leaving() {
  const pending = useStore((s) => s.pendingPurchase);
  const cart = useStore((s) => s.cart);
  const rates = useStore((s) => s.rates);
  const hydrated = useHydrated();
  const p = cart.find((c) => c.product.id === pending?.id)?.product;
  const shop = p?.source === "ae" ? "AliExpress" : "магазин";
  if (!hydrated) return <div className="ui-loader" />;
  return (
    <main className="ui-leaving">
      <div className="ui-loader" />
      <h1>Открываем {shop}</h1>
      <p className="ui-muted">
        Актуальную цену и наличие уточните у продавца. Товар положили в «Куплю»,
        чтобы легко к нему вернуться.
      </p>
      {p && (
        <div className="ui-purchase-product">
          <Img className="ui-image" src={p.images[0]} alt="" />
          <div>
            <strong>{p.title}</strong>
            <p>{formatRub(p.price, p.currency, rates)}</p>
          </div>
        </div>
      )}
      <div className="ui-leaving-footer">
        {p && (
          <a
            className="ui-btn ui-buy"
            href={shopUrl(p, "cart")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Не открылось? Нажмите ↗
          </a>
        )}
        <Link className="ui-text-button" href="/">
          Вернуться в Swiper
        </Link>
        <Link className="ui-text-button" href="/cart">
          Открыть «Куплю»
        </Link>
      </div>
    </main>
  );
}
