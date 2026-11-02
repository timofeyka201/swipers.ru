"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SavedHeader, Empty, ProductRow, BuyButton } from "./Ui";
import Sheet from "./Sheet";
import ProductSheet from "./ProductSheet";
import { IconPriceDown, IconChevron, IconCheck } from "./Icons";
import { useHydrated, useStore } from "@/lib/store";
import { formatRub, toRub, plural } from "@/lib/money";
import { pushWish } from "@/lib/wish/client";
import { learnReason } from "@/lib/taste";
import type { Product } from "@/lib/types";
export function useSavedPrices() {
  const hydrated = useHydrated();
  const ids = useStore((s) => Object.keys(s.watch).sort().join(","));
  useEffect(() => {
    if (!hydrated || !ids) return;
    const controller = new AbortController();
    fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.split(",") }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (d.prices) useStore.getState().applyPrices(d.prices);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [hydrated, ids]);
}
export function PriceDropBanner() {
  const drops = useStore((s) => s.drops);
  const alerts = useStore((s) => s.priceAlerts);
  const rates = useStore((s) => s.rates);
  if (!drops.length || !alerts) return null;
  const total = drops.reduce(
    (sum, d) => sum + (toRub(d.was - d.now, d.currency, rates) ?? 0),
    0,
  );
  return (
    <Link className="ui-price-banner" href="/price-drops">
      <span>
        <IconPriceDown />
      </span>
      <div>
        <strong>
          Подешевели {drops.length}{" "}
          {plural(drops.length, "товар", "товара", "товаров")}
        </strong>
        <small>Выгода {formatRub(total, "RUB", rates)}</small>
      </div>
      <IconChevron />
    </Link>
  );
}
export default function SavedProducts({ tab }: { tab: "likes" | "cart" }) {
  const s = useStore();
  const hydrated = useHydrated();
  const [product, setProduct] = useState<Product | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState("new");
  useSavedPrices();
  const source = tab === "likes" ? s.liked : s.cart.map((c) => c.product);
  const products = useMemo(() => {
    const result = source
      .filter((p) => tab !== "cart" || s.purchases[p.id] !== "dismissed")
      .map((p) => {
        const drop = s.drops.find((d) => d.id === p.id);
        return drop ? { ...p, price: drop.now } : p;
      });
    if (sort === "cheap")
      result.sort(
        (a, b) =>
          (toRub(a.price, a.currency, s.rates) ?? Infinity) -
          (toRub(b.price, b.currency, s.rates) ?? Infinity),
      );
    if (sort === "expensive")
      result.sort(
        (a, b) =>
          (toRub(b.price, b.currency, s.rates) ?? 0) -
          (toRub(a.price, a.currency, s.rates) ?? 0),
      );
    return result;
  }, [source, s.purchases, s.drops, s.rates, sort, tab]);
  if (!hydrated) return <div className="ui-loader" />;
  const remove = (p: Product) =>
    tab === "likes" ? s.unlike(p.id) : s.removeFromCart(p.id);
  const render = (p: Product) => {
    const wished = s.wishlist.some((x) => x.id === p.id);
    const bought = s.purchases[p.id] === "bought";
    return (
      <motion.div
        key={p.id}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) remove(p);
        }}
        tabIndex={0}
        role="group"
        aria-label={p.title + ". Delete — убрать товар"}
        onKeyDown={(e) => {
          if (e.key === "Delete") remove(p);
        }}
      >
        <ProductRow
          product={p}
          onOpen={() => setProduct(p)}
          detail={
            tab === "cart"
              ? bought
                ? "Заказ на стороне продавца"
                : "Открывали в магазине"
              : undefined
          }
        >
          {bought ? (
            <span className="ui-bought-label">
              <IconCheck />
              Уже заказано
            </span>
          ) : (
            <>
              <BuyButton product={p} from={tab} className="ui-btn ui-buy">
                Купить
              </BuyButton>
              {tab === "likes" ? (
                <button
                  className={"ui-btn " + (wished ? "ui-lime-soft" : "ui-soft")}
                  onClick={() => {
                    s.toggleWish(p);
                    pushWish(p, !wished);
                  }}
                >
                  {wished ? "✓ В вишлисте" : "В вишлист"}
                </button>
              ) : (
                <button
                  className="ui-btn ui-soft"
                  onClick={() => {
                    s.setPurchaseStatus(p.id, "bought");
                    useStore.setState({
                      taste: learnReason(s.taste, p, "have"),
                      updatedAt: Date.now(),
                    });
                  }}
                >
                  Уже заказано
                </button>
              )}
            </>
          )}
        </ProductRow>
      </motion.div>
    );
  };
  const pending = products.filter((p) => s.purchases[p.id] !== "bought");
  const bought = products.filter((p) => s.purchases[p.id] === "bought");
  return (
    <main className="ui-page">
      <SavedHeader
        active={tab}
        action={
          <button
            className="ui-round"
            aria-label="Сортировка"
            onClick={() => setSortOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
            </svg>
          </button>
        }
      />
      <div className="ui-page-body">
        {tab === "likes" && <PriceDropBanner />}
        {!products.length ? (
          <Empty
            title={
              tab === "likes"
                ? "Здесь будут ваши находки"
                : "Пока ничего не выбрано"
            }
            detail={
              tab === "likes"
                ? "Свайпайте вправо или нажимайте сердечко — понравившееся останется здесь."
                : "Товары, которые вы открыли у продавца, сохранятся в «Куплю»."
            }
          >
            <Link className="ui-btn ui-dark" href="/">
              Смотреть товары
            </Link>
          </Empty>
        ) : (
          <>
            <div className="ui-drop-grid">
              {(tab === "likes" ? products : pending).map(render)}
            </div>
            {tab === "cart" && bought.length > 0 && (
              <>
                <h2 className="ui-label">Заказано</h2>
                <div className="ui-drop-grid">{bought.map(render)}</div>
                <p className="ui-muted">
                  Статус доставки смотрите у продавца — здесь только ваша
                  отметка.
                </p>
              </>
            )}
            <p className="ui-swipe-remove-help">
              Смахните товар влево, чтобы убрать его
            </p>
          </>
        )}
      </div>
      <ProductSheet product={product} onClose={() => setProduct(null)} />
      <Sheet
        open={sortOpen}
        title="Сортировка"
        onClose={() => setSortOpen(false)}
      >
        <div className="ui-dialog-content">
          {[
            ["new", "Сначала новые"],
            ["cheap", "Сначала дешевле"],
            ["expensive", "Сначала дороже"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={"ui-btn " + (sort === id ? "ui-dark" : "ui-soft")}
              onClick={() => {
                setSort(id);
                setSortOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </main>
  );
}
