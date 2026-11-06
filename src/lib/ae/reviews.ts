import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { aeConfigured, aeFetch, AeError } from "./client";
import type { Product } from "../types";

type Entry = { count?: number; until: number };
type State = {
  day: string;
  calls: number;
  blockedUntil: number;
  items: Record<string, Entry>;
};
let state: Promise<State> | undefined;
let writes = Promise.resolve();
let active = 0;
const pending = new Map<string, Promise<number | undefined>>();
const path = () =>
  join(
    process.env.AUTH_FILE ? dirname(process.env.AUTH_FILE) : ".data",
    "ae-reviews.json",
  );
async function load(): Promise<State> {
  return (state ??= readFile(path(), "utf8")
    .then((s) => JSON.parse(s) as State)
    .catch(() => ({ day: "", calls: 0, blockedUntil: 0, items: {} })));
}
async function save(s: State) {
  const job = writes.then(async () => {
    const file = path();
    await mkdir(dirname(file), { recursive: true });
    const tmp = file + "." + randomUUID() + ".tmp";
    await writeFile(tmp, JSON.stringify(s));
    await rename(tmp, file);
  });
  writes = job.catch(() => {});
  return job;
}

/** Search results are not ordered by identity: only an exact item ID match is safe. */
export function matchingReviewCount(
  rows: unknown,
  id: string,
): number | undefined {
  if (!Array.isArray(rows)) return;
  const wanted = id.replace(/^ae-/, "").replace(/-r\d+$/, "");
  for (const row of rows) {
    if (!row || typeof row.link !== "string") continue;
    let found: string | undefined;
    try {
      found = /\/item\/(\d+)(?:\.html)?(?:\/|$)/.exec(
        new URL(row.link).pathname,
      )?.[1];
    } catch {
      continue;
    }
    if (
      found === wanted &&
      typeof row.reviewsCount === "number" &&
      Number.isSafeInteger(row.reviewsCount) &&
      row.reviewsCount >= 0
    )
      return row.reviewsCount;
  }
}

/** Lazy enrichment: never blocks feed retrieval. Persisted daily budget and seven-day cache. */
export async function productReviewCount(
  product: Product,
): Promise<number | undefined> {
  if (product.reviewsCount !== undefined) return product.reviewsCount;
  if (product.source !== "ae" || !aeConfigured()) return;
  const s = await load();
  const now = Date.now();
  const cached = s.items[product.id];
  if (cached && cached.until > now) return cached.count;
  const running = pending.get(product.id);
  if (running) return running;
  const day = new Date().toISOString().slice(0, 10);
  if (s.day !== day) {
    s.day = day;
    s.calls = 0;
  }
  const configured = Number(process.env.AE_REVIEWS_DAILY_BUDGET ?? 100);
  const budget = Number.isFinite(configured)
    ? Math.max(0, Math.min(2000, configured))
    : 100;
  if (active >= 2 || s.calls >= budget || s.blockedUntil > now)
    return cached?.count;
  active++;
  s.calls++;
  const task = (async () => {
    try {
      // Reserve the budget on disk before calling the partner API.
      await save(s);
      const result = await aeFetch<{ products?: unknown[] }>(
        "/api/v1/products/search",
        {
          query: {
            query: product.title,
            page: 1,
            pageSize: 20,
            priceMin: 0,
            priceMax: 2147483647,
            freeDelivery: false,
          },
        },
      );
      const count = matchingReviewCount(result.products, product.id);
      s.items[product.id] = {
        count,
        until: now + (count === undefined ? 86400000 : 7 * 86400000),
      };
      // Bound storage; recently fetched entries survive eviction.
      s.items = Object.fromEntries(
        Object.entries(s.items)
          .sort((a, b) => b[1].until - a[1].until)
          .slice(0, 3000),
      );
      await save(s);
      return count;
    } catch (e) {
      s.blockedUntil =
        now +
        (e instanceof AeError && [401, 403, 429].includes(e.status)
          ? 3600000
          : 60000);
      await save(s).catch(() => {});
      console.error(
        "Количество отзывов AE недоступно:",
        e instanceof Error ? e.message : "ошибка",
      );
      return cached?.count;
    } finally {
      active--;
      pending.delete(product.id);
    }
  })();
  pending.set(product.id, task);
  return task;
}
