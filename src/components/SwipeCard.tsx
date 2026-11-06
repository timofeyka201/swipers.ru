"use client";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IconCart, IconHeart, IconX } from "./Icons";
import ReviewCount from "./ReviewCount";
import PhotoGallery from "./PhotoGallery";
import { swipeDecision, swipeExit } from "@/lib/gestures";
import { BuyButton } from "./Ui";
import { useStore, type Decision } from "@/lib/store";
import type { Product } from "@/lib/types";
import { formatRub, compact } from "@/lib/money";
type Props = {
  product: Product;
  active: boolean;
  depth: number;
  onDecide: (d: Decision) => void;
  onOpen: () => void;
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
  const controls = useAnimationControls();
  const alive = useRef(true);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    alive.current = true;
    void controls.start({
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.18 },
    });
    return () => {
      alive.current = false;
      controls.stop();
    };
  }, [controls]);
  const locked = useRef(false);
  const dragged = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
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
  const commit = async (decision: Decision) => {
    if (locked.current) return;
    locked.current = true;
    setExiting(true);
    await controls.start(swipeExit(decision));
    if (alive.current) onDecide(decision);
  };
  const end = (_: unknown, info: PanInfo) => {
    const decision = swipeDecision(info.offset.x, info.offset.y);
    if (decision) void commit(decision);
    else
      void controls.start({
        x: 0,
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 30 },
      });
  };
  return (
    <article
      className="ui-swipe-wrap"
      style={{
        zIndex: 10 - depth,
        pointerEvents: active && !exiting ? "auto" : "none",
      }}
      data-exiting={exiting}
      aria-hidden={exiting}
    >
      <motion.div
        className="ui-swipe-card"
        style={{
          rotate: active ? rotation : 0,
          x: active ? x : 0,
          y: active ? y : 0,
        }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={controls}
        drag={active && !exiting}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
        }}
        onPointerDownCapture={() => {
          dragged.current = false;
        }}
        onDragEnd={end}
      >
        <PhotoGallery
          key={p.id}
          className="ui-swipe-photo"
          images={p.images}
          title={p.title}
          swipe={false}
          eager={active}
        >
          {p.source === "ae" &&
            p.price !== undefined &&
            p.priceMax !== undefined &&
            p.priceMax > p.price && (
              <span className="ui-discount">
                −{Math.round((1 - p.price / p.priceMax) * 100)}%
              </span>
            )}
          <span className="ui-photo-reason">{explanation}</span>
        </PhotoGallery>
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
          <button
            draggable={false}
            style={{ userSelect: "none" }}
            onClick={(e) => {
              if (e.detail === 0 || !dragged.current) onOpen();
            }}
            className="ui-swipe-name"
          >
            {p.title}
          </button>
          <div className="ui-rating">
            {p.rating !== undefined && <b>★ {p.rating.toFixed(1)}</b>}
            <span>
              <ReviewCount product={p} />
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
              commit("dislike");
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
            onClick={() => commit("like")}
          >
            <IconHeart />
          </button>
        </div>
      )}
    </article>
  );
}
