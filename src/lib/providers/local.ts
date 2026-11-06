import { recommend } from "../recommendations";
import {
  catalogCategories,
  catalogGroups,
  catalogInfo,
  catalogProducts,
  catalogTags,
} from "../catalog";
import { categoryLabel, groupLabel, OTHER_GROUP } from "../categories";
import { baseId } from "../ids";
import { toRub } from "../money";
import type { Product } from "../types";
import { searchCatalog } from "../search";
import {
  decodeCursor,
  encodeCursor,
  type Filters,
  type GroupFacet,
  type PageArgs,
  type Provider,
  type ProviderPage,
} from "./types";

/**
 * Собственная база товаров: файл data/catalog.json, который отдаётся
 * постранично. Ни от каких внешних API не зависит — а значит, не ловит ни
 * лимитов, ни блокировок по IP, которыми маркетплейсы встречают серверные
 * запросы из дата-центров.
 *
 * Наполняется импортёрами (scripts/build-catalog-*.mjs), которые пишут снапшот
 * на диск. Читается он лениво, поэтому обновлённый каталог подхватывается без
 * перезапуска приложения.
 */

const PAGE = 18;

/**
 * Категории приходят из разных источников разными слагами: «furniture» и
 * «Furniture» — это одно и то же. Схлопываем их по русскому ярлыку, он же
 * становится значением фильтра. Одиночные категории в список не берём: выбирать
 * из них нечего, а строку фильтров они забивают.
 */
function buildCategoryFacets(all: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of all) {
    if (!p.category) continue;
    const label = categoryLabel(p.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([label]) => label);
}

/**
 * Цены отложенных товаров. Идентификаторы с суффиксом круга («-r1») указывают
 * на тот же товар, поэтому суффикс отбрасываем.
 */
export function currentPrices(ids: string[]): Record<string, number> {
  const byId = new Map(catalogProducts().map((p) => [p.id, p]));
  const out: Record<string, number> = {};
  for (const id of ids) {
    const base = baseId(id);
    const price = byId.get(base)?.price;
    if (price !== undefined) out[id] = price;
  }
  return out;
}

/**
 * Разделы с их категориями. Тридцать с лишним категорий плоской строкой —
 * это свиток, по которому надо скроллить до «Купальников»; с разделом
 * сверху до них два тапа: «Женская одежда» → «Купальники».
 *
 * Пустые разделы в строку не попадают, иначе человек нажимает на раздел и
 * оказывается в пустоте.
 */
function buildGroupFacets(all: Product[]): GroupFacet[] {
  const counts = new Map<string, Map<string, number>>();
  for (const p of all) {
    if (!p.category) continue;
    const group = groupLabel(p);
    if (!counts.has(group)) counts.set(group, new Map());
    const inside = counts.get(group)!;
    const label = categoryLabel(p.category);
    inside.set(label, (inside.get(label) ?? 0) + 1);
  }

  const size = (inside: Map<string, number>) =>
    [...inside.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .filter(([, inside]) => size(inside) >= 2)
    .sort((a, b) => size(b[1]) - size(a[1]) || a[0].localeCompare(b[0], "ru"))
    .map(([title, inside]) => ({
      title,
      categories: [...inside.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
        .map(([label]) => label),
    }));
}

/**
 * Диапазон цен, разделы и список категорий для панели фильтров.
 * Пересчитываются вместе со снапшотом: прежние константы вычислялись один раз
 * при запуске и после обновления каталога показывали бы вчерашние категории.
 */
export function facets(): {
  categories: string[];
  groups: GroupFacet[];
  tags: string[];
  maxPrice: number;
  currency: string;
} {
  const all = catalogProducts();
  return {
    categories: buildCategoryFacets(all),
    groups: buildGroupFacets(all),
    // Метки нужны тесту вкусов: спрашивать про то, чего в каталоге нет, незачем.
    tags: catalogTags(),
    maxPrice: all.reduce(
      (max, p) => (p.price !== undefined && p.price > max ? p.price : max),
      0,
    ),
    currency: all[0]?.currency ?? "RUB",
  };
}

export function meta(): {
  kind: string;
  generatedAt: string | null;
  total: number;
  categories: string[];
  source: string;
} {
  const info = catalogInfo();
  return { ...info, categories: catalogCategories() };
}

/** Фильтры применяются к своей базе — у неё есть и категории, и цены. */
function passes(
  p: Product,
  f?: Filters,
  rates: Record<string, number> = {},
): boolean {
  if (!f) return true;
  if (f.group && groupLabel(p) !== f.group) return false;
  // В фильтре лежат ярлыки, а не слаги — так совпадают синонимы из разных источников.
  if (
    f.categories?.length &&
    (!p.category || !f.categories.includes(categoryLabel(p.category)))
  )
    return false;
  const price =
    f.priceCurrency === "RUB" ? toRub(p.price, p.currency, rates) : p.price;
  if (f.minPrice !== undefined && (price === undefined || price < f.minPrice))
    return false;
  if (f.maxPrice !== undefined && (price === undefined || price > f.maxPrice))
    return false;
  if (
    f.onlyDiscount &&
    !(p.priceMax !== undefined && p.price !== undefined && p.priceMax > p.price)
  )
    return false;
  return true;
}

/** Название источника по снапшоту: витрина на AliExpress не должна называться
 *  «своей базой» — человек видит этот ярлык в настройках. */
const SNAPSHOT_LABEL: Record<string, string> = {
  ae: "AliExpress",
  global: "Открытый каталог",
};

export const localProvider: Provider = {
  id: "local",
  get label() {
    return SNAPSHOT_LABEL[catalogInfo().kind] ?? "Своя база";
  },
  get note() {
    return `${catalogProducts().length} карточек в снапшоте. Работает всегда, без внешних API.`;
  },
  needsToken: false,
  ready: () => catalogProducts().length > 0,

  async page({
    query,
    cursor,
    seed,
    filters,
    hint,
  }: PageArgs): Promise<ProviderPage> {
    const { offset, round } = decodeCursor(cursor);

    // Снимок берём один раз на запрос: между строками он может смениться, если
    // импортёр как раз дописал новый.
    const all = catalogProducts();
    if (!all.length)
      return { products: [], cursor: encodeCursor(0, round), looped: false };

    // Отвергнутое исключаем жёстко: свайп влево — это «больше не показывай».
    // Приходить могут и карточки с суффиксом круга — сверяем по товару.
    const banned = new Set((hint?.exclude ?? []).map(baseId));

    /*
     * «Остальное» — это запасник, а не лента.
     *
     * Раздел не достался тем карточкам, чьё название правилам ни о чём не
     * сказало: там и настоящая одежда, и случайный хлам, и понять заранее
     * нельзя. В ленту такое не идёт — она обещает витрину одежды, а не
     * лотерею. Но и выбрасывать их мы не стали, поэтому достать их всё ещё
     * можно двумя способами: выбрать раздел «Остальное» руками или найти
     * поиском по слову из названия. Поиск ниже идёт отдельной дорогой и
     * этого правила не знает — там человек сам сказал, что ищет.
     *
     * Если каталог ещё не размечен, прятать нечего: без этой проверки
     * запасной каталог, у которого разделов нет вовсе, показал бы пустую
     * ленту.
     */
    const hideUngrouped =
      filters?.group !== OTHER_GROUP && catalogGroups().length > 0;
    const allowed = (p: Product) =>
      hideUngrouped && !p.group ? false : passes(p, filters, hint?.rates ?? {});

    /*
     * Поиск идёт отдельной дорогой.
     *
     * Выдача по запросу упорядочена близостью к нему, а не вкусом и не
     * случайностью: человек, набравший «красное платье», ждёт красных платьев,
     * а не того, что ему обычно нравится. Круги здесь тоже ни к чему —
     * найденное конечно, и когда оно кончится, честнее так и сказать.
     */
    if (query.trim()) {
      const { ranked, total, loose } = searchCatalog(all, query, {
        accept: (p) => passes(p, filters, hint?.rates ?? {}),
        filterKey: JSON.stringify(filters ?? {}),
      });
      const found: Product[] = [];
      let i = offset;
      for (; i < ranked.length && found.length < PAGE; i++) {
        if (!banned.has(ranked[i].id)) found.push(ranked[i]);
      }
      return {
        products: found,
        cursor: encodeCursor(i, 0),
        looped: false,
        total,
        loose,
      };
    }

    const products = recommend(all, hint, seed, offset, allowed, PAGE);
    return {
      products,
      cursor: encodeCursor(offset + 1, 0),
      looped: false,
      noMore: products.length === 0,
      total: all.length,
    };
  },
};
