"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHydrated, useStore, type Decision } from "@/lib/store";
import { loadNextPage } from "@/lib/feed";
import { track } from "@/lib/stat";
import { shopUrl } from "@/lib/shop";
import TopBar from "@/components/TopBar";
import SwipeCard from "@/components/SwipeCard";
import ProductSheet from "@/components/ProductSheet";
import FilterSheet from "@/components/FilterSheet";
import Onboarding from "@/components/Onboarding";
import RefineCard from "@/components/RefineCard";
import RejectReasonSheet from "@/components/RejectReasonSheet";
import { Empty } from "@/components/Ui";
import { IconCheck, IconX } from "@/components/Icons";
import type { Product } from "@/lib/types";
import type { GroupFacet } from "@/lib/providers/types";
export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const s = useStore();
  const [facets, setFacets] = useState<{
    groups: GroupFacet[];
    maxPrice: number;
    currency: string;
  }>({ groups: [], maxPrice: 100000, currency: "RUB" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const [total, setTotal] = useState(0);
  const [coach, setCoach] = useState(false);
  const [retry, setRetry] = useState(0);
  const [tick, setTick] = useState(0);
  const inflight = useRef(false);
  const active = s.deck[s.index];
  const lastImpression = useRef("");
  useEffect(() => {
    if (
      !active ||
      lastImpression.current === active.id ||
      !hydrated ||
      !s.onboarded ||
      coach ||
      filtersOpen ||
      product
    )
      return;
    lastImpression.current = active.id;
    track("view", {
      product: active.id,
      category: active.category,
      why: active.why,
      algorithm: "hybrid-v1",
    });
  }, [active, hydrated, s.onboarded, coach, filtersOpen, product]);
  const refine =
    !!s.pendingReason &&
    (s.taste.budget === undefined ||
      !Object.keys(s.taste.tags ?? {}).some((k) => k.startsWith("стиль:")) ||
      !Object.keys(s.taste.tags ?? {}).some((k) => k.startsWith("материал:")));
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      useStore.setState({ query: q });
      useStore.getState().setFilters({});
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.facets) setFacets(d.facets);
      })
      .catch(() => {});
    track("open", {
      standalone: window.matchMedia("(display-mode: standalone)").matches,
    });
  }, []);
  useEffect(() => {
    setEnded(false);
    setError("");
  }, [s.query, s.filters]);
  useEffect(() => {
    if (
      !hydrated ||
      !s.onboarded ||
      ended ||
      error ||
      inflight.current ||
      s.deck.length - s.index > 6
    )
      return;
    inflight.current = true;
    setLoading(true);
    const key = JSON.stringify({ query: s.query, filters: s.filters });
    loadNextPage()
      .then((result) => {
        const state = useStore.getState();
        if (
          key !== JSON.stringify({ query: state.query, filters: state.filters })
        )
          return;
        if (!result.ok) setError(result.error ?? "Нет связи");
        if (result.noMore || (result.tries === 4 && !state.deck[state.index]))
          setEnded(true);
        if (result.total !== undefined) setTotal(result.total);
      })
      .finally(() => {
        inflight.current = false;
        setLoading(false);
        setTick((v) => v + 1);
      });
  }, [
    hydrated,
    s.onboarded,
    s.deck.length,
    s.index,
    s.cursor,
    s.query,
    s.filters,
    ended,
    error,
    retry,
    tick,
  ]);
  const decide = (decision: Decision) => {
    const p = useStore.getState().decide(decision);
    if (!p) return;
    track("swipe", {
      decision,
      why: p.why,
      algorithm: "hybrid-v1",
      product: p.id,
      category: p.category,
      group: p.group,
    });
    if (decision === "super" && p.url) {
      const store = useStore.getState();
      store.noteOrder(p);
      store.setPurchaseStatus(
        p.id,
        store.purchases[p.id] === "bought" ? "bought" : "opened",
      );
      store.setPendingPurchase({ id: p.id, at: Date.now() });
      window.open(shopUrl(p, "deck"), "_blank", "noopener,noreferrer");
      router.push("/leaving");
    }
  };
  const reset = () => {
    useStore.setState({
      query: "",
      filters: {},
      deck: [],
      index: 0,
      cursor: null,
    });
    setEnded(false);
    setError("");
    setRetry((v) => v + 1);
  };
  if (!hydrated) return <div className="ui-loader" aria-label="Загрузка" />;
  if (!s.onboarded) return <Onboarding onDone={() => setCoach(true)} />;
  const categories = s.filters.group
    ? (facets.groups.find((g) => g.title === s.filters.group)?.categories ?? [])
    : [];
  return (
    <div className="ui-feed">
      <TopBar
        groups={facets.groups}
        group={s.filters.group ?? null}
        categories={categories}
        active={s.filters.categories ?? []}
        extraFilters={0}
        query={s.query}
        onPickGroup={(group) => {
          s.setFilters({
            ...s.filters,
            group: group ?? undefined,
            categories: [],
          });
        }}
        onToggleCategory={(c) =>
          s.setFilters({
            ...s.filters,
            categories: s.filters.categories?.includes(c)
              ? s.filters.categories.filter((v) => v !== c)
              : [...(s.filters.categories ?? []), c],
          })
        }
        onOpenFilters={() => setFiltersOpen(true)}
        onClearQuery={reset}
        onUndo={s.undo}
        canUndo={s.history.length > 0}
      />
      <div className="ui-feed-stage">
        {refine ? (
          <RefineCard key="refine" onDone={() => s.answerReason(null)} />
        ) : active ? (
          <SwipeCard
            key={active.id}
            product={active}
            active
            depth={0}
            onDecide={decide}
            onOpen={() => setProduct(active)}
          />
        ) : error ? (
          <Empty
            title="Нет связи"
            detail="Новые карточки подгрузятся, когда появится интернет. Сохранённое открывается и без сети."
          >
            <button
              className="ui-btn ui-dark"
              onClick={() => {
                setError("");
                setRetry((v) => v + 1);
              }}
            >
              Попробовать снова
            </button>
            <Link className="ui-btn ui-soft" href="/likes">
              Открыть сохранённое
            </Link>
          </Empty>
        ) : ended ? (
          <Empty
            icon={<IconCheck />}
            title={s.query ? "Это всё по запросу" : "Вы посмотрели подборку"}
            detail={
              total
                ? "Вы посмотрели доступные товары. Понравившееся — в «Сохранённом»."
                : "Попробуйте другой запрос или измените фильтры."
            }
          >
            <Link className="ui-btn ui-dark" href="/likes">
              Открыть сохранённое
            </Link>
            <button
              className="ui-btn ui-soft"
              onClick={() => setFiltersOpen(true)}
            >
              Изменить запрос
            </button>
            <button className="ui-text-button" onClick={reset}>
              Вернуться к ленте
            </button>
          </Empty>
        ) : (
          <div
            className="ui-loader"
            aria-label={loading ? "Подбираем товары" : "Загрузка"}
          />
        )}
      </div>
      <ProductSheet product={product} onClose={() => setProduct(null)} />
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={facets.groups}
        maxPrice={facets.maxPrice}
        currency={facets.currency}
        value={s.filters}
        query={s.query}
        onApply={(filters, query) => {
          useStore.setState({ query });
          s.setFilters(filters);
          setError("");
          setEnded(false);
          setRetry((v) => v + 1);
        }}
      />
      <RejectReasonSheet
        product={refine ? null : s.pendingReason}
        onAnswer={s.answerReason}
      />
      {coach && (
        <div
          className="ui-coach"
          onClick={() => setCoach(false)}
          role="dialog"
          aria-label="Подсказка жестов"
        >
          <div>
            <h2>
              Свайпайте карточку
              <br />
              или используйте кнопки
            </h2>
            <p>
              Нажимайте слева или справа на фото, чтобы листать снимки. Название
              открывает подробности.
            </p>
            <button className="ui-btn ui-white" onClick={() => setCoach(false)}>
              Понятно
            </button>
            <small>или нажмите в любом месте экрана</small>
            <div className="ui-coach-labels">
              <span>← Не понравилось</span>
              <span>↑ Купить</span>
              <span>Понравилось →</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
