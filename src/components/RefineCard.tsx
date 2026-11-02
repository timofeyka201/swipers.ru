"use client";
import { useState } from "react";
import { STYLE_OPTIONS, MATERIAL_OPTIONS } from "@/lib/facets";
import { useStore } from "@/lib/store";
/** One optional question between batches of products, never a blocking questionnaire. */
export default function RefineCard({ onDone }: { onDone: () => void }) {
  const taste = useStore((s) => s.taste);
  const [picked, setPicked] = useState<string[]>([]);
  const kind =
    taste.budget === undefined
      ? "budget"
      : !Object.keys(taste.tags ?? {}).some((k) => k.startsWith("стиль:"))
        ? "style"
        : "material";
  const finish = (budget?: number) => {
    const tags = { ...taste.tags };
    for (const tag of picked) tags[tag] = 2;
    useStore.setState({
      taste: { ...taste, tags, ...(budget !== undefined ? { budget } : {}) },
      updatedAt: Date.now(),
    });
    onDone();
  };
  const options = kind === "style" ? STYLE_OPTIONS : MATERIAL_OPTIONS;
  return (
    <section className="ui-refine ui-box">
      <span className="ui-label">Подстроим ленту</span>
      <h2>
        {kind === "budget"
          ? "В каком бюджете искать?"
          : kind === "style"
            ? "Какое вам ближе?"
            : "Какие материалы любите?"}
      </h2>
      <p className="ui-muted">
        {kind === "budget"
          ? "Ненавязчиво: это ориентир для подбора, а не ограничение."
          : "Можно отметить несколько — или пропустить."}
      </p>
      {kind === "budget" ? (
        <div className="ui-refine-options">
          {[
            [1500, "До 1 500 ₽"],
            [5000, "До 5 000 ₽"],
            [20000, "До 20 000 ₽"],
            [0, "Без ограничений"],
          ].map(([n, label]) => (
            <button
              key={n}
              className="ui-btn ui-soft"
              onClick={() => finish(Number(n))}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="ui-taste-chips">
            {options.map((o) => (
              <button
                key={o.tag}
                className={picked.includes(o.tag) ? "is-active" : ""}
                aria-pressed={picked.includes(o.tag)}
                onClick={() =>
                  setPicked((v) =>
                    v.includes(o.tag)
                      ? v.filter((t) => t !== o.tag)
                      : [...v, o.tag],
                  )
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="ui-btn ui-dark" onClick={() => finish()}>
            Дальше
          </button>
        </>
      )}
      <button className="ui-text-button" onClick={onDone}>
        Пропустить
      </button>
    </section>
  );
}
