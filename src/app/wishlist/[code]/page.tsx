"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Img from "@/components/Img";
import AuthSheet from "@/components/AuthSheet";
import ProductSheet from "@/components/ProductSheet";
import { BuyButton, Empty } from "@/components/Ui";
import { useHydrated, useStore } from "@/lib/store";
import {
  loadFriendWishlist,
  loadMyWishlist,
  toggleReserve,
} from "@/lib/wish/client";
import {
  formatCode,
  normalizeCode,
  type FriendItem,
  type FriendView,
} from "@/lib/wish/types";
import { formatRub } from "@/lib/money";
import type { Product } from "@/lib/types";
const productOf = (item: FriendItem): Product => ({
  ...item.product,
  id: item.product?.id ?? item.id,
  url: item.url ?? item.product?.url ?? "",
  title: item.title,
  images: item.image ? [item.image] : (item.product?.images ?? []),
  price: item.price,
  currency: item.currency,
  tiers: item.product?.tiers ?? [],
  attributes: item.product?.attributes ?? [],
  skus: item.product?.skus ?? [],
  reviews: item.product?.reviews ?? [],
  source: item.product?.source ?? "custom",
});
export default function FriendWishlist() {
  const params = useParams<{ code: string }>();
  const code = normalizeCode(params.code ?? "");
  const account = useStore((s) => s.account);
  const rates = useStore((s) => s.rates);
  const hydrated = useHydrated();
  const [view, setView] = useState<FriendView | null>(null);
  const [own, setOwn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [auth, setAuth] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const load = useCallback(async () => {
    setView(null);
    setOwn(false);
    setError("");
    if (!code) {
      setError("Ссылка на вишлист некорректна");
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await loadFriendWishlist(code);
    if (result.kind === "mine") {
      const mine = await loadMyWishlist();
      if (mine) {
        setView({
          ...mine,
          canReserve: false,
          items: mine.items.map((i) => ({
            ...i,
            reserved: false,
            mine: false,
          })),
        });
        setOwn(true);
      }
    } else if (result.kind === "ok") {
      setView(result.wishlist);
      setOwn(false);
      setError("");
    } else setError(result.message);
    setLoading(false);
  }, [code]);
  useEffect(() => {
    if (hydrated) void load();
  }, [hydrated, account, load]);
  const reserve = async (item: FriendItem) => {
    if (!account) {
      setAuth(true);
      return;
    }
    if (!code || busy || own) return;
    setBusy(item.id);
    setError("");
    const result = await toggleReserve(code, item.id, !item.mine);
    if (result.wishlist) setView(result.wishlist);
    if (result.error) setError(result.error);
    setBusy("");
  };
  return (
    <main className="ui-page">
      <div className="ui-friend-heading">
        <Link href="/" className="ui-mark">
          S
        </Link>
        <span className="ui-label">
          Вишлист · {code ? formatCode(code) : ""}
        </span>
      </div>
      <div className="ui-page-body">
        {loading ? (
          <div className="ui-loader" />
        ) : !view ? (
          <Empty
            title="Вишлист не открылся"
            detail={error || "Владелец закрыл доступ к списку."}
          >
            <button className="ui-btn ui-dark" onClick={() => void load()}>
              Попробовать снова
            </button>
            <Link className="ui-btn ui-soft" href="/">
              Вернуться в Swiper
            </Link>
          </Empty>
        ) : (
          <>
            <h1>{view.ownerName} мечтает о</h1>
            <p className="ui-muted">
              Отметьте подарок, чтобы никто не купил то же самое. Владелец не
              узнает, кто и что выбрал.
            </p>
            {own && (
              <p className="ui-muted">
                Ваш список глазами друга. Брони здесь скрыты от вас.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="ui-drop-grid">
              {view.items.map((item) => (
                <article key={item.id} className="ui-friend-item">
                  <div className="ui-product-row">
                    <button
                      className="ui-row-image"
                      aria-label={"Открыть " + item.title}
                      onClick={() => setProduct(productOf(item))}
                    >
                      <Img
                        className="ui-image"
                        src={item.image}
                        alt={item.title}
                      />
                    </button>
                    <div className="ui-row-copy">
                      <strong>{item.title}</strong>
                      <span>
                        {item.price !== undefined
                          ? formatRub(item.price, item.currency, rates)
                          : "Цена не указана"}
                      </span>
                      {item.note && <small>{item.note}</small>}
                    </div>
                    {item.reserved && !item.mine ? (
                      <span className="ui-reserved-label">Уже дарят</span>
                    ) : item.mine ? (
                      <span className="ui-giving-label">Вы дарите это</span>
                    ) : (
                      <button
                        className="ui-btn ui-dark ui-reserve-button"
                        disabled={!!busy || own}
                        onClick={() => void reserve(item)}
                      >
                        {busy === item.id ? "…" : "Подарю"}
                      </button>
                    )}
                  </div>
                  {item.mine && (
                    <div className="ui-friend-actions">
                      <BuyButton product={productOf(item)} from="gift" />
                      <button
                        className="ui-btn ui-soft"
                        disabled={!!busy}
                        onClick={() => void reserve(item)}
                      >
                        Отменить
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <section className="ui-wish-hero ui-friend-cta">
              <h2>Соберите свой вишлист</h2>
              <p>Пора мечтать о своём, а друзьям знать, что дарить.</p>
              <Link className="ui-btn ui-lime" href="/wishlist">
                Начать
              </Link>
            </section>
          </>
        )}
      </div>
      <AuthSheet open={auth} onClose={() => setAuth(false)} />
      <ProductSheet product={product} onClose={() => setProduct(null)} />
    </main>
  );
}
