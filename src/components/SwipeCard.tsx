"use client";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useRef, useState } from "react";
import { IconCart, IconHeart, IconX } from "./Icons";
import Img from "./Img";
import { BuyButton } from "./Ui";
import { useStore, type Decision } from "@/lib/store";
import type { Product } from "@/lib/types";
import { formatRub, compact } from "@/lib/money";
export type ExitWay = Decision | "reset";
type Props = {
  product: Product;
  active: boolean;
  depth: number;
  showHint?: boolean;
  exitWay: ExitWay;
  onDecide: (d: Decision) => void;
  onOpen: () => void;
  onUndo: () => void;
  canUndo: boolean;
};
export default function SwipeCard({
  product: p,
  active,
  depth,
  onDecide,
  onOpen,
}: Props) {
  const rates = useStore((s) => s.rates);
  const taste = useStore((s) => s.taste);
  const [photo, setPhoto] = useState(0);
  const dragged = useRef(false);
  const x = useMotionValue(0);
  const rotation = useTransform(x, [-180, 180], [-12, 12]);
  const matching = (p.tags ?? [])
    .find((t) => (taste.tags?.[t] ?? 0) > 0)
    ?.split(":")
    .at(-1);
  const explanation =
    p.why === "taste"
      ? matching
        ? "Похоже на ваши лайки: " + matching
        : "Подобрано по вашему вкусу"
      : "Новая находка для вас";
  const end = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 85) {
      onDecide(info.offset.x > 0 ? "like" : "dislike");
    } else if (info.offset.y < -100) {
      onDecide("super");
    }
    setTimeout(() => {
      dragged.current = false;
    }, 100);
  };
  return (
    <motion.article
      className="ui-swipe-wrap"
      style={{
        zIndex: 10 - depth,
        rotate: active ? rotation : 0,
        x: active ? x : 0,
        pointerEvents: active ? "auto" : "none",
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 - depth * 0.018, y: depth * 5 }}
      exit={{
        opacity: 0,
        x: x.get() < 0 ? -400 : 400,
        rotate: x.get() < 0 ? -15 : 15,
        transition: { duration: 0.18 },
      }}
    >
      <motion.div
        className="ui-swipe-card"
        drag={active}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.8}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={end}
      >
        <button
          className="ui-swipe-photo"
          onClick={() => {
            if (!dragged.current) onOpen();
          }}
          aria-label={"Открыть товар: " + p.title}
        >
          <Img
            className="ui-image"
            src={p.images[photo] ?? p.images[0]}
            alt={p.title}
            eager={active}
          />
          <span className="ui-photo-progress">
            {p.images.slice(0, 7).map((_, i) => (
              <span key={i} className={photo === i ? "is-active" : ""} />
            ))}
          </span>
          {p.source === "ae" &&
            p.price !== undefined &&
            p.priceMax !== undefined &&
            p.priceMax > p.price && (
              <span className="ui-discount">
                −{Math.round((1 - p.price / p.priceMax) * 100)}%
              </span>
            )}
          <span className="ui-photo-reason">{explanation}</span>
        </button>
        {p.images.length > 1 && (
          <button
            className="ui-photo-next"
            aria-label="Следующее фото"
            onClick={() => setPhoto((v) => (v + 1) % p.images.length)}
          >
            ›
          </button>
        )}
        <div className="ui-swipe-copy">
          <strong className="ui-price">
            {formatRub(p.price, p.currency, rates)}
            {p.source === "ae" &&
              p.priceMax !== undefined &&
              p.price !== undefined &&
              p.priceMax > p.price && (
                <del>{formatRub(p.priceMax, p.currency, rates)}</del>
              )}
          </strong>
          <button onClick={onOpen} className="ui-swipe-name">
            {p.title}
          </button>
          <div className="ui-rating">
            {p.rating !== undefined && <b>★ {p.rating.toFixed(1)}</b>}
            <span>
              {p.reviewsCount ? compact(p.reviewsCount) + " отзывов" : ""}
              {p.soldCount ? " · " + compact(p.soldCount) + " заказов" : ""}
            </span>
          </div>
          {p.seller?.name && (
            <p className="ui-seller">Магазин {p.seller.name}</p>
          )}
        </div>
      </motion.div>
      {active && (
        <div className="ui-swipe-actions">
          <button
            className="ui-swipe-action ui-dislike"
            aria-label="Не понравилось"
            onClick={() => {
              x.set(-1);
              onDecide("dislike");
            }}
          >
            <IconX />
          </button>
          <BuyButton
            product={p}
            from="deck"
            className="ui-swipe-action ui-buy-small"
          >
            <IconCart />
            <span className="sr-only">Купить</span>
          </BuyButton>
          <button
            className="ui-swipe-action ui-like"
            aria-label="Понравилось"
            onClick={() => onDecide("like")}
          >
            <IconHeart />
          </button>
        </div>
      )}
    </motion.article>
  );
}
