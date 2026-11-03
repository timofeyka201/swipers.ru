import type { Decision } from "./store";

/** Choose the dominant axis; a diagonal upward gesture must not become a like. */
export function swipeDecision(x: number, y: number): Decision | null {
  if (Math.abs(x) > Math.abs(y) && Math.abs(x) >= 85)
    return x > 0 ? "like" : "dislike";
  if (y <= -100 && Math.abs(y) > Math.abs(x)) return "super";
  return null;
}

export function swipeExit(decision: Decision | "reset") {
  return {
    x: decision === "dislike" ? -600 : decision === "like" ? 600 : 0,
    y: decision === "super" ? -900 : 0,
    rotate: decision === "dislike" ? -15 : decision === "like" ? 15 : 0,
    opacity: 0,
    transition: { duration: 0.22 },
  };
}

export function photoIndex(
  current: number,
  delta: number,
  count: number,
): number {
  if (count < 1) return 0;
  return (((current + delta) % count) + count) % count;
}

export function galleryImages(images: string[] = [], cover?: string): string[] {
  return [
    ...new Set(
      [cover, ...images].filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      ),
    ),
  ];
}
