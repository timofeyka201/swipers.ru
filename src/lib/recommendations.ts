import type { Product } from "./types";
import type { TasteHint } from "./taste";
import { categoryLabel } from "./categories";
import { baseId } from "./ids";
import { toRub } from "./money";
import { mulberry32, shuffle } from "./providers/types";

type Index = {
  source: Product[];
  categories: Map<string, Product[]>;
  tags: Map<string, Product[]>;
  brands: Map<string, Product[]>;
  order: Product[];
};
let cached: Index | undefined;
function index(all: Product[]): Index {
  if (cached?.source === all) return cached;
  const next: Index = {
    source: all,
    categories: new Map(),
    tags: new Map(),
    brands: new Map(),
    order: shuffle(all, 7193),
  };
  const add = (map: Map<string, Product[]>, key: string, p: Product) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
    else map.set(key, [p]);
  };
  for (const p of next.order) {
    add(next.categories, categoryLabel(p.category), p);
    if (p.brand) add(next.brands, p.brand, p);
    for (const tag of p.tags ?? []) add(next.tags, tag, p);
  }
  return (cached = next);
}

/** Bounded retrieval from interest indexes plus a catalogue-wide discovery source.
 * Unselected candidates remain eligible on the next request; only real exposure excludes an item.
 */
export function recommend(
  all: Product[],
  hint: TasteHint = {},
  seed: number,
  offset: number,
  accept: (p: Product) => boolean,
  count = 18,
): Product[] {
  const idx = index(all);
  const excluded = new Set((hint.exclude ?? []).map(baseId));
  const pool = new Map<string, Product>();
  const rnd = mulberry32(seed + offset * 104729);
  const take = (bucket: Product[], limit: number) => {
    const start = Math.floor(rnd() * bucket.length);
    let added = 0;
    for (let n = 0; n < bucket.length && added < limit; n++) {
      const p = bucket[(start + n) % bucket.length];
      if (excluded.has(baseId(p.id)) || pool.has(baseId(p.id)) || !accept(p))
        continue;
      pool.set(baseId(p.id), p);
      added++;
    }
  };
  const interests = (weights: Record<string, number> = {}) =>
    Object.entries(weights)
      .filter(([, w]) => Number.isFinite(w) && w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  const categories = { ...hint.categories };
  for (const key of hint.picked ?? [])
    categories[categoryLabel(key)] = (categories[categoryLabel(key)] ?? 0) + 2;
  for (const [key] of interests(categories))
    take(idx.categories.get(key) ?? [], 45);
  for (const [key] of interests(hint.tags)) take(idx.tags.get(key) ?? [], 25);
  for (const [key] of interests(hint.brands))
    take(idx.brands.get(key) ?? [], 15);
  take(idx.order, 180);

  const scored = [...pool.values()].map((p) => {
    const category = categoryLabel(p.category);
    let relevance =
      (categories[category] ?? 0) + (hint.brands?.[p.brand ?? ""] ?? 0) * 0.5;
    const tags = (p.tags ?? []).reduce(
      (sum, tag) => sum + (hint.tags?.[tag] ?? 0),
      0,
    );
    relevance += Math.max(-3, Math.min(3, tags * 0.35));
    const budget = hint.categoryBudgets?.[category] ?? hint.budget;
    const price = toRub(p.price, p.currency, hint.rates ?? {});
    if (budget && price && price > budget)
      relevance -= Math.min(4, 2 * Math.log2(price / budget));
    // A tiny quality prior, shrunk towards neutral when few reviews exist.
    const confidence = Math.min(1, (p.reviewsCount ?? 0) / 50);
    const quality =
      p.rating === undefined ? 0 : (p.rating - 4) * confidence * 0.4;
    return { p, relevance, score: relevance + quality + rnd() * 0.3 };
  });
  const known =
    interests(categories).length > 0 || interests(hint.tags).length > 0;
  const exploration = known ? 3 : 7;
  const out: Product[] = [];
  const categoryCounts = new Map<string, number>();
  const sellerCounts = new Map<string, number>();
  const titles = new Set<string>();
  while (out.length < count && scored.length) {
    const explore =
      Math.floor(((out.length + 1) * exploration) / count) >
      Math.floor((out.length * exploration) / count);
    let best = -1,
      bestScore = -Infinity;
    for (let i = 0; i < scored.length; i++) {
      const { p, score, relevance } = scored[i];
      const title = p.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (titles.has(title)) continue;
      const category = categoryLabel(p.category);
      const seller = p.seller?.name ?? "";
      const diversity =
        (categoryCounts.get(category) ?? 0) * 0.8 +
        (seller ? (sellerCounts.get(seller) ?? 0) * 1.5 : 0);
      const value =
        (explore ? Math.min(0, relevance) + rnd() : score) - diversity;
      if (value > bestScore) {
        bestScore = value;
        best = i;
      }
    }
    if (best < 0) break;
    const { p } = scored.splice(best, 1)[0];
    out.push({ ...p, why: explore || !known ? "explore" : "taste" });
    const category = categoryLabel(p.category),
      seller = p.seller?.name ?? "";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    sellerCounts.set(seller, (sellerCounts.get(seller) ?? 0) + 1);
    titles.add(p.title.toLowerCase().replace(/\s+/g, " ").trim());
  }
  return out;
}
