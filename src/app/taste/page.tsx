"use client";
import { useState } from "react";
import { STYLE_OPTIONS, MATERIAL_OPTIONS } from "@/lib/facets";
import { Header } from "@/components/Ui";
import { useStore, useHydrated } from "@/lib/store";
import { emptyTaste, type Taste } from "@/lib/taste";
import Sheet from "@/components/Sheet";
const styles = [
  "Простое и базовое",
  "Классика",
  "Спортивное",
  "Яркое и нарядное",
  "Винтаж",
  "Милое",
  "Аниме",
  "Тёмное и дерзкое",
  "Бохо и этно",
];
const materials = [
  "Кожа",
  "Хлопок",
  "Лён",
  "Шерсть",
  "Шёлк",
  "Джинса",
  "Трикотаж",
  "Дерево",
  "Металл",
  "Стекло",
];
export default function TastePage() {
  const taste = useStore((s) => s.taste);
  const hydrated = useHydrated();
  const [budget, setBudget] = useState(false);
  const [reset, setReset] = useState(false);
  const change = (next: Taste) =>
    useStore.setState({
      taste: next,
      updatedAt: Date.now(),
      deck: [],
      index: 0,
      cursor: null,
    });
  if (!hydrated) return <div className="ui-loader" />;
  const positive = Object.entries(taste.tags ?? {}).filter(([, v]) => v > 0);
  const negative = Object.entries(taste.tags ?? {}).filter(([, v]) => v < 0);
  const remove = (key: string) => {
    const tags = { ...taste.tags };
    delete tags[key];
    change({ ...taste, tags });
  };
  const toggle = (value: string, prefix: string) => {
    const key =
      [...STYLE_OPTIONS, ...MATERIAL_OPTIONS].find((o) => o.label === value)
        ?.tag ?? prefix + ":" + value.toLowerCase();
    const tags = { ...taste.tags };
    if (tags[key]) delete tags[key];
    else tags[key] = 2;
    change({ ...taste, tags });
  };
  return (
    <main className="ui-page">
      <Header title="Мой вкус" back="/profile" />
      <div className="ui-page-body">
        <p className="ui-muted">
          Так лента понимает вас.
          <br />
          Уберите лишнее, и подбор сразу поменяется.
        </p>
        <section className="ui-box space-y-3">
          <h2 className="ui-label">Выбранные темы</h2>
          <div className="ui-taste-chips">
            {taste.picked.length ? (
              taste.picked.map((p) => (
                <button
                  key={p}
                  className="positive"
                  aria-label={"Убрать тему " + p}
                  onClick={() =>
                    change({
                      ...taste,
                      picked: taste.picked.filter((x) => x !== p),
                    })
                  }
                >
                  {p} ×
                </button>
              ))
            ) : (
              <span>Все темы</span>
            )}
          </div>
        </section>
        <section className="ui-box space-y-3">
          <h2 className="ui-label">Нравится</h2>
          <div className="ui-taste-chips">
            {positive.length ? (
              positive.map(([key]) => (
                <button
                  key={key}
                  className="positive"
                  onClick={() => remove(key)}
                >
                  {key.split(":").at(-1)} ×
                </button>
              ))
            ) : (
              <span>Уточняется по вашим лайкам</span>
            )}
          </div>
        </section>
        <section className="ui-box space-y-3">
          <h2 className="ui-label">Не показывать</h2>
          <div className="ui-taste-chips">
            {negative.length ? (
              negative.map(([key]) => (
                <button
                  key={key}
                  className="negative"
                  onClick={() => remove(key)}
                >
                  {key.split(":").at(-1)} ×
                </button>
              ))
            ) : (
              <span>Пока нет ограничений</span>
            )}
          </div>
        </section>
        <section className="ui-box space-y-3">
          <h2 className="ui-label">Стиль</h2>
          <div className="ui-taste-chips">
            {styles.map((v) => (
              <button
                key={v}
                className={
                  (taste.tags?.[
                    STYLE_OPTIONS.find((o) => o.label === v)!.tag
                  ] ?? 0) > 0
                    ? "is-active"
                    : ""
                }
                onClick={() => toggle(v, "стиль")}
              >
                {v}
              </button>
            ))}
          </div>
        </section>
        <section className="ui-box space-y-3">
          <h2 className="ui-label">Материалы</h2>
          <div className="ui-taste-chips">
            {materials.map((v) => (
              <button
                key={v}
                className={
                  (taste.tags?.[
                    MATERIAL_OPTIONS.find((o) => o.label === v)!.tag
                  ] ?? 0) > 0
                    ? "is-active"
                    : ""
                }
                onClick={() => toggle(v, "материал")}
              >
                {v}
              </button>
            ))}
          </div>
        </section>
        <button
          className="ui-box ui-taste-budget"
          onClick={() => setBudget(true)}
        >
          <span>
            <span className="ui-label">Бюджет на вещь</span>
            <strong>
              {taste.budget
                ? "до " + taste.budget.toLocaleString("ru-RU") + " ₽"
                : "Без ограничений"}
            </strong>
          </span>
          <span>Изменить</span>
        </button>
        <button
          className="ui-text-button ui-reset-taste"
          onClick={() => setReset(true)}
        >
          Сбросить вкус и начать заново
        </button>
      </div>
      <Sheet
        open={budget}
        title="Бюджет на вещь"
        onClose={() => setBudget(false)}
      >
        <div className="ui-dialog-content">
          {[
            [1500, "До 1 500 ₽"],
            [5000, "1 500–5 000 ₽"],
            [20000, "5 000–20 000 ₽"],
            [0, "Без ограничений"],
          ].map(([amount, label]) => (
            <button
              key={String(amount)}
              className="ui-btn ui-soft"
              onClick={() => {
                change({ ...taste, budget: Number(amount) || undefined });
                setBudget(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet
        open={reset}
        title="Сбросить вкус?"
        onClose={() => setReset(false)}
      >
        <div className="ui-dialog-content">
          <p className="ui-muted">
            Сохранённые товары останутся. Подборка начнёт учиться заново.
          </p>
          <button
            className="ui-btn ui-dark"
            onClick={() => {
              change(emptyTaste());
              setReset(false);
            }}
          >
            Сбросить вкус
          </button>
          <button className="ui-btn ui-soft" onClick={() => setReset(false)}>
            Отмена
          </button>
        </div>
      </Sheet>
    </main>
  );
}
