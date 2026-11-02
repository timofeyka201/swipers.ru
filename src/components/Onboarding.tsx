"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { GroupFacet } from "@/lib/providers/types";
const primary = ["Женская одежда", "Мужская одежда", "Аксессуары", "Дом"];
const more = [
  "Обувь",
  "Украшения",
  "Кухня",
  "Подарки",
  "Спорт",
  "Красота",
  "Для детей",
  "Техника",
];
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupFacet[]>([]);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setGroups(d.facets?.groups ?? []))
      .catch(() => {});
  }, []);
  const toggle = (v: string) =>
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const finish = (all = false) => {
    const picked = all
      ? []
      : selected.flatMap(
          (title) =>
            groups.find((g) => g.title === title || g.title.includes(title))
              ?.categories ?? [title],
        );
    const s = useStore.getState();
    s.finishTaste(picked);
    s.finishOnboarding();
    onDone();
  };
  return (
    <main className="ui-interest-page">
      <span className="ui-mark">S</span>
      <div>
        <h1>Что вам интересно?</h1>
        <p className="ui-muted" style={{ marginTop: 10 }}>
          Отметьте всё, что хотите видеть в ленте.
          <br />
          Можно выбрать несколько тем.
        </p>
      </div>
      <div className="ui-interest-main">
        {primary.map((v) => (
          <button
            key={v}
            className={"ui-chip " + (selected.includes(v) ? "is-active" : "")}
            aria-pressed={selected.includes(v)}
            onClick={() => toggle(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <span className="ui-label">Ещё можно добавить</span>
      <div className="ui-interest-more">
        {more.map((v) => (
          <button
            key={v}
            className={"ui-chip " + (selected.includes(v) ? "is-active" : "")}
            aria-pressed={selected.includes(v)}
            onClick={() => toggle(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="ui-interest-footer">
        <button className="ui-btn ui-dark" onClick={() => finish()}>
          Смотреть товары{selected.length ? " · " + selected.length : ""}
        </button>
        <button className="ui-text-button" onClick={() => finish(true)}>
          Покажите всё
        </button>
      </div>
    </main>
  );
}
