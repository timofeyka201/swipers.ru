"use client";
import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { IconSearch } from "./Icons";
import { useStore } from "@/lib/store";
import type { Filters, GroupFacet } from "@/lib/providers/types";
type Props = {
  open: boolean;
  onClose: () => void;
  groups: GroupFacet[];
  maxPrice: number;
  currency: string;
  value: Filters;
  query: string;
  onApply: (filters: Filters, query: string) => void;
};
export default function FilterSheet({
  open,
  onClose,
  groups,
  value,
  query,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<Filters>(value);
  const [text, setText] = useState(query);
  const [recent, setRecent] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const rates = useStore((s) => s.rates);
  useEffect(() => {
    if (open) {
      setDraft(value);
      setText(query);
      setError("");
      try {
        const values = JSON.parse(
          localStorage.getItem("swiper-recent-searches") ?? "[]",
        );
        setRecent(
          Array.isArray(values)
            ? values.filter((x) => typeof x === "string").slice(0, 6)
            : [],
        );
      } catch {
        setRecent([]);
      }
    }
  }, [open, value, query]);
  useEffect(() => {
    if (!open) return;
    setCount(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          filters: draft,
          seed: 1,
          hint: { rates },
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => setCount(typeof d.total === "number" ? d.total : null))
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, text, draft, rates]);
  const categories =
    groups.find((g) => g.title === draft.group)?.categories ?? [];
  const apply = () => {
    if ((draft.minPrice ?? 0) < 0 || (draft.maxPrice ?? 0) < 0) {
      setError("Цена не может быть отрицательной");
      return;
    }
    if (
      draft.minPrice !== undefined &&
      draft.maxPrice !== undefined &&
      draft.minPrice > draft.maxPrice
    ) {
      setError("Цена «от» должна быть меньше цены «до»");
      return;
    }
    const q = text.trim();
    if (q) {
      try {
        localStorage.setItem(
          "swiper-recent-searches",
          JSON.stringify([q, ...recent.filter((x) => x !== q)].slice(0, 6)),
        );
      } catch {}
    }
    onApply(draft, q);
    onClose();
  };
  return (
    <Sheet
      open={open}
      fullScreen
      title="Что ищем"
      onClose={onClose}
      footer={
        <div className="ui-filter-footer">
          <button
            className="ui-btn ui-soft"
            onClick={() => {
              setText("");
              setDraft({});
              setError("");
            }}
          >
            Сбросить
          </button>
          <button className="ui-btn ui-dark" onClick={apply}>
            {count === null
              ? "Показать товары"
              : "Показать " + count + " товаров"}
          </button>
        </div>
      }
    >
      <div className="ui-filter-body">
        <form
          className="ui-input-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <IconSearch />
          <input
            aria-label="Что ищем"
            placeholder="Поиск по витрине"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={120}
          />
        </form>
        {recent.length > 0 && (
          <section className="ui-filter-section">
            <h3>Недавно искали</h3>
            <div className="ui-interest-more">
              {recent.map((q) => (
                <button className="ui-chip" key={q} onClick={() => setText(q)}>
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="ui-filter-section">
          <h3>Раздел</h3>
          <div className="ui-filter-groups">
            {groups.map((g) => (
              <button
                key={g.title}
                className={
                  "ui-chip " + (draft.group === g.title ? "is-active" : "")
                }
                aria-pressed={draft.group === g.title}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    group: d.group === g.title ? undefined : g.title,
                    categories: [],
                  }))
                }
              >
                {g.title}
              </button>
            ))}
          </div>
        </section>
        {categories.length > 0 && (
          <section className="ui-filter-section">
            <h3>В разделе «{draft.group}»</h3>
            <div className="ui-interest-more">
              {categories.map((c) => (
                <button
                  key={c}
                  className={
                    "ui-chip " +
                    (draft.categories?.includes(c) ? "is-active" : "")
                  }
                  aria-pressed={!!draft.categories?.includes(c)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      categories: d.categories?.includes(c)
                        ? d.categories.filter((x) => x !== c)
                        : [...(d.categories ?? []), c],
                    }))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="ui-filter-section">
          <h3>Цена, ₽</h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <input
              className="ui-input"
              aria-label="Цена от"
              placeholder="от"
              type="number"
              min={0}
              value={draft.minPrice ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  priceCurrency: "RUB",
                  minPrice: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
            <input
              className="ui-input"
              aria-label="Цена до"
              placeholder="до"
              type="number"
              min={0}
              value={draft.maxPrice ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  priceCurrency: "RUB",
                  maxPrice: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </section>
        <label className="ui-check-row">
          Только со скидкой
          <input
            type="checkbox"
            checked={!!draft.onlyDiscount}
            onChange={(e) =>
              setDraft((d) => ({ ...d, onlyDiscount: e.target.checked }))
            }
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
