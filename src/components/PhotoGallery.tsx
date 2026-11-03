"use client";
import { useRef, useState, type ReactNode } from "react";
import Img from "./Img";
import { photoIndex } from "@/lib/gestures";

/** In the feed horizontal dragging belongs to the card; other galleries own it. */
export default function PhotoGallery({
  images,
  title,
  className = "",
  swipe = true,
  compact = false,
  eager = false,
  children,
}: {
  images: string[];
  title: string;
  className?: string;
  swipe?: boolean;
  compact?: boolean;
  eager?: boolean;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const count = images.length;
  const current = photoIndex(index, 0, count);
  const step = (delta: number) => setIndex((v) => photoIndex(v, delta, count));
  return (
    <div
      className={`ui-gallery ${compact ? "ui-gallery-compact" : ""} ${className}`}
      role="group"
      aria-label={`Фотографии: ${title}`}
    >
      {count > 1 ? (
        <button
          type="button"
          className="ui-gallery-photo"
          aria-label={`Фото ${current + 1} из ${count}. Нажмите слева или справа для переключения`}
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0) return;
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            suppressClick.current = false;
            if (swipe && !compact)
              e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            start.current = null;
            suppressClick.current = true;
          }}
          onPointerUp={(e) => {
            const from = start.current;
            start.current = null;
            if (!from || from.id !== e.pointerId) return;
            const dx = e.clientX - from.x,
              dy = e.clientY - from.y;
            suppressClick.current = Math.hypot(dx, dy) > 6;
            if (
              swipe &&
              !compact &&
              Math.abs(dx) >= 40 &&
              Math.abs(dx) > Math.abs(dy)
            )
              step(dx < 0 ? 1 : -1);
          }}
          onClick={(e) => {
            if (e.detail !== 0 && suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            step(
              e.detail === 0 || e.clientX - rect.left >= rect.width / 2
                ? 1
                : -1,
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              step(e.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          <Img
            className="ui-image"
            src={images[current]}
            alt={title}
            eager={eager}
          />
        </button>
      ) : (
        <div className="ui-gallery-photo">
          <Img className="ui-image" src={images[0]} alt={title} eager={eager} />
        </div>
      )}
      {count > 1 && !compact && (
        <>
          <button
            type="button"
            className="ui-gallery-arrow ui-gallery-prev"
            aria-label="Предыдущее фото"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="ui-gallery-arrow ui-gallery-next"
            aria-label="Следующее фото"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => step(1)}
          >
            ›
          </button>
          <span className="ui-gallery-count" role="status" aria-live="polite">
            {current + 1} / {count}
          </span>
        </>
      )}
      {children}
    </div>
  );
}
