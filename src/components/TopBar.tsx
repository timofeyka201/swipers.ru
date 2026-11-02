"use client";
import Link from "next/link";
import { IconUndo, IconSearch, IconHeart, IconSliders, IconX } from "./Icons";
import { Avatar } from "./Ui";
import { useStore } from "@/lib/store";
import type { GroupFacet } from "@/lib/providers/types";
type Props = {
  groups: GroupFacet[];
  group: string | null;
  categories: string[];
  active: string[];
  extraFilters: number;
  query: string;
  onPickGroup: (g: string | null) => void;
  onToggleCategory: (c: string) => void;
  onOpenFilters: () => void;
  onClearQuery: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
};
export default function TopBar(p: Props) {
  const liked = useStore((s) => s.liked.length);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.history.length > 0);
  return (
    <header className="ui-feed-header safe-top">
      <div className="ui-feed-title">
        <h1>
          {p.query ? (
            <button className="ui-query" onClick={p.onOpenFilters}>
              <IconSearch />
              <span>{p.query}</span>
            </button>
          ) : (
            "Для вас"
          )}
        </h1>
        <button
          className="ui-round"
          onClick={p.onUndo ?? undo}
          disabled={!(p.canUndo ?? canUndo)}
          aria-label="Вернуть карточку"
        >
          <IconUndo />
        </button>
        <button
          className="ui-round"
          onClick={p.onOpenFilters}
          aria-label="Поиск"
        >
          <IconSearch />
        </button>
        <Link
          className="ui-round ui-saved-heart"
          href="/likes"
          aria-label={"Сохранённое, " + liked + " товаров"}
        >
          <IconHeart />
          {liked > 0 && <span>{liked}</span>}
        </Link>
        <Avatar />
      </div>
      <div className="ui-chips no-scrollbar">
        <button
          className="ui-chip"
          aria-label="Фильтры"
          onClick={p.onOpenFilters}
        >
          <IconSliders />
        </button>
        <button
          className={
            "ui-chip " + (!p.group && !p.active.length ? "is-active" : "")
          }
          onClick={() => {
            p.onPickGroup(null);
          }}
        >
          Все
        </button>
        {p.groups.map((g) => (
          <button
            key={g.title}
            className={"ui-chip " + (p.group === g.title ? "is-active" : "")}
            onClick={() => p.onPickGroup(p.group === g.title ? null : g.title)}
          >
            {g.title}
          </button>
        ))}
      </div>
      {p.group && (
        <div className="ui-chips ui-subchips no-scrollbar">
          {p.categories.map((c) => (
            <button
              key={c}
              className={"ui-chip " + (p.active.includes(c) ? "is-active" : "")}
              onClick={() => p.onToggleCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {p.query && (
        <div className="ui-active-filters">
          <span>Результаты по запросу</span>
          <button onClick={p.onClearQuery} aria-label="Сбросить поиск">
            <IconX />
          </button>
        </div>
      )}
    </header>
  );
}
