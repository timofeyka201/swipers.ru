"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SavedHeader, Empty } from "@/components/Ui";
import { IconPlus, IconShare, IconGear, IconX } from "@/components/Icons";
import PhotoGallery from "@/components/PhotoGallery";
import { galleryImages } from "@/lib/gestures";
import Img from "@/components/Img";
import ProductSheet from "@/components/ProductSheet";
import AuthSheet from "@/components/AuthSheet";
import WishCardForm from "@/components/WishCardForm";
import WishlistShare from "@/components/WishlistShare";
import Sheet from "@/components/Sheet";
import { useHydrated, useStore } from "@/lib/store";
import { formatRub, plural } from "@/lib/money";
import {
  loadMyWishlist,
  loadReservations,
  removeItem,
  saveWishlistSettings,
} from "@/lib/wish/client";
import {
  formatCode,
  type OwnerItem,
  type OwnerView,
  type ReservedEntry,
} from "@/lib/wish/types";
import type { Product } from "@/lib/types";
export default function Wishlist() {
  const s = useStore();
  const hydrated = useHydrated();
  const [view, setView] = useState<OwnerView | null>(null);
  const [gifts, setGifts] = useState<ReservedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<OwnerItem | null>(null);
  const [share, setShare] = useState(false);
  const [settings, setSettings] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const id = useStore.getState().account?.id;
    if (!id) return;
    setLoading(true);
    const [mine, reserved] = await Promise.all([
      loadMyWishlist(),
      loadReservations(),
    ]);
    if (useStore.getState().account?.id !== id) return;
    setView(mine);
    setGifts(reserved);
    setError(
      mine ? "" : "Список не открылся. Проверьте связь и попробуйте ещё раз.",
    );
    setLoading(false);
  }, []);
  useEffect(() => {
    if (hydrated && s.account) void refresh();
    if (hydrated && !s.account) {
      setView(null);
      setGifts([]);
      setLoading(false);
      setError("");
    }
  }, [hydrated, s.account, refresh]);
  useEffect(() => {
    setShowGifts(
      new URLSearchParams(window.location.search).get("gifts") === "1",
    );
  }, []);
  if (!hydrated) return <div className="ui-loader" />;
  const items: OwnerItem[] = s.account
    ? (view?.items ?? [])
    : s.wishlist.map((p) => ({
        id: p.id,
        source: p.source === "custom" ? "custom" : "swiper",
        title: p.title,
        image: p.images[0],
        price: p.price,
        currency: p.currency,
        url: p.url,
        addedAt: "",
        product: p,
        note: p.description,
      }));
  const remove = async (item: OwnerItem) => {
    if (!s.account) {
      s.toggleWish(item.product!);
      return;
    }
    setBusy(true);
    const next = await removeItem(item.id);
    if (next) setView(next);
    else setError("Не удалось удалить желание");
    setBusy(false);
  };
  return (
    <main className="ui-page">
      <SavedHeader
        active="wishlist"
        action={
          <button
            className="ui-round"
            aria-label="Добавить своё желание"
            onClick={() => {
              setEditing(null);
              setForm(true);
            }}
          >
            <IconPlus />
          </button>
        }
      />
      <div className="ui-page-body">
        {showGifts ? (
          <>
            <div className="ui-wish-toolbar">
              <h2>Я дарю</h2>
              <button onClick={() => setShowGifts(false)}>Мой вишлист</button>
            </div>
            {!s.account ? (
              <Empty
                title="Ваши подарки друзьям"
                detail="Войдите, чтобы видеть забронированные подарки."
              >
                <button
                  className="ui-btn ui-dark"
                  onClick={() => setAuth(true)}
                >
                  Войти по почте
                </button>
              </Empty>
            ) : gifts.length ? (
              gifts.map((g) => (
                <Link
                  key={g.code + g.itemId}
                  className="ui-product-row"
                  href={"/wishlist/" + g.code}
                >
                  {g.image && (
                    <Img
                      className="ui-image ui-gift-thumbnail"
                      src={g.image}
                      alt=""
                    />
                  )}
                  <span>
                    <strong>{g.title}</strong>
                    <p className="ui-muted">Для {g.ownerName}</p>
                  </span>
                </Link>
              ))
            ) : (
              <Empty
                title="Вы пока ничего не бронировали"
                detail="Откройте вишлист друга по ссылке или найдите его по никнейму."
              >
                <Link className="ui-btn ui-dark" href="/profile">
                  Найти друга
                </Link>
              </Empty>
            )}
          </>
        ) : (
          <>
            <section className="ui-wish-hero">
              <div className="ui-wish-toolbar">
                <small>
                  {view
                    ? "Код списка " + formatCode(view.code)
                    : "Сохранено на этом устройстве"}
                </small>
                {view && (
                  <button
                    aria-label="Настройки списка"
                    onClick={() => {
                      setTitle(view.title);
                      setShared(view.shared);
                      setSettings(true);
                    }}
                  >
                    <IconGear />
                  </button>
                )}
              </div>
              <h2>
                {view?.title && view.title !== "Мой вишлист"
                  ? view.title
                  : "Что мне подарить"}
              </h2>
              <button
                className="ui-btn ui-white"
                onClick={() =>
                  s.account && view ? setShare(true) : setAuth(true)
                }
              >
                <IconShare />
                Поделиться
              </button>
              {view && !view.shared && (
                <small>
                  Доступ по ссылке закрыт. Откройте его в настройках списка.
                </small>
              )}
            </section>
            {!s.account && (
              <p className="ui-muted">
                Собирайте желания без входа. Почта понадобится, чтобы поделиться
                списком с друзьями.
              </p>
            )}
            <div className="ui-wish-toolbar">
              <strong>
                {items.length
                  ? items.length +
                    " " +
                    plural(items.length, "желание", "желания", "желаний")
                  : "Ваши желания"}
              </strong>
              <button
                onClick={() => {
                  setEditing(null);
                  setForm(true);
                }}
              >
                ＋ Своё желание
              </button>
            </div>
            {loading ? (
              <div className="ui-loader" />
            ) : error ? (
              <div role="alert" className="ui-box space-y-3">
                <p>{error}</p>
                <button
                  className="ui-btn ui-dark"
                  onClick={() => void refresh()}
                >
                  Повторить
                </button>
              </div>
            ) : !items.length ? (
              <Empty
                title="Что вам подарить?"
                detail="Добавляйте товары из ленты или своё желание с любого сайта."
              >
                <Link className="ui-btn ui-dark" href="/">
                  Найти в ленте
                </Link>
                <button
                  className="ui-btn ui-soft"
                  onClick={() => {
                    setEditing(null);
                    setForm(true);
                  }}
                >
                  Добавить своё желание
                </button>
              </Empty>
            ) : (
              <div className="ui-wish-grid">
                {items.map((item) => (
                  <article key={item.id} className="ui-wish-item">
                    <PhotoGallery
                      key={item.id}
                      className="ui-wish-media"
                      compact
                      images={galleryImages(item.product?.images, item.image)}
                      title={item.title}
                    />
                    <strong>
                      {item.price !== undefined
                        ? formatRub(item.price, item.currency, s.rates)
                        : "Цена не указана"}
                    </strong>
                    <button
                      className="ui-wish-open"
                      onClick={() =>
                        item.product && item.source !== "custom"
                          ? setProduct({
                              ...item.product,
                              title: item.title,
                              price: item.price,
                              currency: item.currency,
                              url: item.url ?? item.product.url,
                              images: galleryImages(
                                item.product.images,
                                item.image,
                              ),
                              description:
                                item.note ?? item.product.description,
                            })
                          : (setEditing(item), setForm(true))
                      }
                    >
                      <span>{item.title}</span>
                    </button>
                    <div className="ui-wish-edit">
                      <button
                        onClick={() => {
                          setEditing(item);
                          setForm(true);
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void remove(item)}
                        aria-label={"Убрать " + item.title}
                      >
                        <IconX />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <div className="ui-wish-bottom">
          <button onClick={() => setShowGifts((v) => !v)}>
            {showGifts ? "Мой вишлист" : "Я дарю"}
          </button>
          <Link href="/profile">Найти друга</Link>
        </div>
      </div>
      <WishCardForm
        open={form}
        item={editing}
        onClose={() => setForm(false)}
        onSaved={(next) => setView(next)}
      />
      <AuthSheet open={auth} onClose={() => setAuth(false)} />
      {view && (
        <WishlistShare
          open={share}
          code={view.code}
          onClose={() => setShare(false)}
        />
      )}
      <ProductSheet product={product} onClose={() => setProduct(null)} />
      <Sheet
        open={settings}
        title="Настройки вишлиста"
        onClose={() => setSettings(false)}
      >
        <form
          className="ui-dialog-content"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            const next = await saveWishlistSettings({
              title: title.trim(),
              shared,
            });
            if (next) {
              setView(next);
              setSettings(false);
            } else setError("Не удалось сохранить настройки");
            setBusy(false);
          }}
        >
          <label className="ui-field-label">
            Название
            <input
              className="ui-input"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="ui-check-row">
            Открыт по ссылке
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
          </label>
          <button className="ui-btn ui-dark" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </form>
      </Sheet>
    </main>
  );
}
