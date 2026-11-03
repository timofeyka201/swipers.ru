"use client";
import { useState } from "react";
import Sheet from "./Sheet";
import Img from "./Img";
import PhotoGallery from "./PhotoGallery";
import { IconArrowLeft, IconHeart, IconShare } from "./Icons";
import { BuyButton } from "./Ui";
import { useStore } from "@/lib/store";
import { formatRub, compact } from "@/lib/money";
import type { Product } from "@/lib/types";
import { cardUrlAbsolute } from "@/lib/shop";
import { toast } from "./Toast";
function ProductDetails({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const rates = useStore((s) => s.rates);
  const liked = useStore((s) => s.liked);
  const toggleWish = useStore((s) => s.toggleWish);
  const wished = useStore((s) => s.wishlist);
  const source = useStore((s) => s.deck);
  const [detail, setDetail] = useState(false);
  if (!product) return null;
  const p = product;
  const isLiked = liked.some((x) => x.id === p.id);
  const related = source
    .filter(
      (x) =>
        x.id !== p.id &&
        ((!!p.category && x.category === p.category) ||
          (!!p.group && x.group === p.group)),
    )
    .slice(0, 6);
  const share = async () => {
    const data = {
      title: p.title,
      url:
        p.source === "custom"
          ? p.url || window.location.href
          : cardUrlAbsolute(p),
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        toast("Ссылка скопирована");
      }
    } catch {}
  };
  return (
    <Sheet
      open
      title="Карточка товара"
      fullScreen
      hideHeader
      onClose={onClose}
      footer={
        <div className="ui-product-footer">
          <button
            className={"ui-round ui-like " + (isLiked ? "is-liked" : "")}
            aria-label={
              isLiked ? "Убрать из понравившегося" : "Сохранить в понравившееся"
            }
            onClick={() =>
              isLiked
                ? useStore.getState().unlike(p.id)
                : useStore.getState().like(p)
            }
          >
            <IconHeart />
          </button>
          <BuyButton product={p} />
        </div>
      }
    >
      <div className="ui-product-hero">
        <PhotoGallery
          className="ui-product-gallery"
          images={p.images}
          title={p.title}
          eager
        />
        <button
          className="ui-round ui-product-back"
          onClick={onClose}
          aria-label="Назад"
        >
          <IconArrowLeft />
        </button>
        <button
          className="ui-round ui-product-share"
          onClick={() => void share()}
          aria-label="Поделиться"
        >
          <IconShare />
        </button>
      </div>
      <div className="ui-product-info">
        <strong className="ui-price ui-product-price">
          {formatRub(p.price, p.currency, rates)}
          {p.source === "ae" &&
            p.priceMax !== undefined &&
            p.price !== undefined &&
            p.priceMax > p.price && (
              <del>{formatRub(p.priceMax, p.currency, rates)}</del>
            )}
        </strong>
        <h1>{p.title}</h1>
        <div className="ui-product-stats">
          <div>
            <b>
              {p.rating !== undefined
                ? "★ " + p.rating.toFixed(1)
                : "Нет оценки"}
            </b>
            <span>
              {p.reviewsCount
                ? compact(p.reviewsCount) + " отзывов"
                : "Количество отзывов не указано"}
            </span>
          </div>
          <div>
            <b>{p.soldCount ? compact(p.soldCount) + "+" : "—"}</b>
            <span>заказов</span>
          </div>
        </div>
        {p.seller?.name && (
          <div className="ui-store-row">
            <span>{p.seller.name.slice(0, 1)}</span>
            <strong>{p.seller.name}</strong>
          </div>
        )}
        {related.length > 0 && (
          <section>
            <h2>Похожие</h2>
            <div className="ui-related no-scrollbar">
              {related.map((item) => (
                <a key={item.id} href={"/t/" + encodeURIComponent(item.id)}>
                  <Img
                    className="ui-image"
                    src={item.images[0]}
                    alt={item.title}
                  />
                  <strong>{formatRub(item.price, item.currency, rates)}</strong>
                </a>
              ))}
            </div>
          </section>
        )}
        <button
          className="ui-btn ui-soft"
          onClick={() => {
            toggleWish(p);
            void import("@/lib/wish/client").then((m) =>
              m.pushWish(p, !wished.some((x) => x.id === p.id)),
            );
          }}
        >
          {wished.some((x) => x.id === p.id) ? "В вишлисте" : "В вишлист"}
        </button>
        <button
          className="ui-detail-toggle"
          onClick={() => setDetail((v) => !v)}
          aria-expanded={detail}
        >
          Описание и характеристики <span>{detail ? "−" : "+"}</span>
        </button>
        {detail && (
          <div className="ui-product-detail">
            {p.description && <p>{p.description.replace(/<[^>]+>/g, " ")}</p>}
            {p.attributes.map((a, i) => (
              <div key={i}>
                <span>{a.name}</span>
                <b>{a.value}</b>
              </div>
            ))}
            {p.reviews.map((r) => (
              <p key={r.id}>
                {r.rating ? "★ " + r.rating + " · " : ""}
                {r.text}
              </p>
            ))}
            {!p.description && !p.attributes.length && !p.reviews.length && (
              <p>Подробности и актуальное наличие — на странице продавца.</p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default function ProductSheet(props: {
  product: Product | null;
  onClose: () => void;
}) {
  return props.product ? (
    <ProductDetails key={props.product.id} {...props} />
  ) : null;
}
