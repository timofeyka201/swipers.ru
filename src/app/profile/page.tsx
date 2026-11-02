"use client";
import Nickname from "@/components/Nickname";
import FindFriend from "@/components/FindFriend";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountCard from "@/components/AccountCard";
import Img from "@/components/Img";
import RankCard from "@/components/RankCard";
import SettingsSheet from "@/components/SettingsSheet";
import {
  IconBox,
  IconChevron,
  IconExternal,
  IconGear,
  IconPhone,
  IconRuler,
  IconTrash,
  IconUser,
} from "@/components/Icons";
import { formatRub, plural } from "@/lib/money";
import { hasSizes } from "@/lib/sizes";
import { useHydrated, useStore } from "@/lib/store";

/**
 * Профиль: всё про человека на одной странице.
 *
 * До этого личное было рассыпано: счётчики жили в шапке ленты, размеры и вход
 * — в шторке настроек, а имени с телефоном не было вовсе. Теперь раздел один
 * и порядок в нём от частого к редкому: кто вы, какой у вас ранг, ваши данные,
 * размеры, заказы. Настройки сервиса остались шторкой — за значком в углу:
 * тему и курс валют открывают раз в жизни.
 */
export default function ProfilePage() {
  const hydrated = useHydrated();
  const orders = useStore((s) => s.orders);
  const forgetOrder = useStore((s) => s.forgetOrder);
  const rates = useStore((s) => s.rates);
  const providerLabel = useStore((s) => s.providerLabel);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalog, setCatalog] = useState<{ size: number; currency: string }>({
    size: 0,
    currency: "RUB",
  });

  // Настройкам нужны размер витрины и её валюта: раньше их приносила лента,
  // но шторка переехала сюда вместе с кнопкой.
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(
        (d: { facets?: { currency?: string }; catalog?: { total?: number } }) =>
          setCatalog({
            size: d.catalog?.total ?? 0,
            currency: d.facets?.currency ?? "RUB",
          }),
      )
      .catch(() => undefined);
  }, []);

  if (!hydrated) return <div className="flex-1" />;

  return (
    <div className="flex flex-1 flex-col pb-6">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between bg-[var(--color-bg)]/92 px-4 py-3 backdrop-blur-md">
        <h1 className="font-display text-[28px] leading-none">Профиль</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Настройки"
          className="soft-shadow flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-ink)]"
        >
          <IconGear className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-6 px-4">
        <section>
          <AccountCard />
          <Nickname />
          <FindFriend />
        </section>

        <section>
          <Caption>Ранг</Caption>
          <RankCard />
        </section>

        <section>
          <Caption>
            Заказы
            {orders.length > 0 && (
              <span className="tnum ml-1 text-[var(--color-muted)]">
                · {orders.length}
              </span>
            )}
          </Caption>
          {orders.length === 0 ? (
            <div className="soft-shadow rounded-[var(--radius-tile)] bg-[var(--color-surface)] px-4 py-5 text-center">
              <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                <IconBox className="h-6 w-6" />
              </span>
              <p className="text-[14px] font-semibold">Пока пусто</p>
              <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-snug text-[var(--color-muted)]">
                {/* Честно про то, чего витрина не знает: своих заказов у неё нет. */}
                Здесь появятся товары, за которыми вы ушли в магазин. Сам заказ
                оформляется на
                {providerLabel ? ` ${providerLabel}` : " стороне продавца"} —
                его состояние видно там же, в вашем аккаунте магазина.
              </p>
              <Link
                href="/cart"
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-5 text-[13px] font-semibold"
              >
                Открыть корзину
              </Link>
            </div>
          ) : (
            <ul className="soft-shadow divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-tile)] bg-[var(--color-surface)]">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-2.5 px-3 py-3">
                  {/* Без подписи: в квадрат 56 точек название не влезает и
                      вылезает за края серой плашки. */}
                  <Img
                    src={o.image}
                    alt={o.title}
                    className="h-14 w-14 shrink-0 rounded-xl"
                    fallbackLabel=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">
                      {o.title}
                    </p>
                    <p className="tnum mt-0.5 text-[12px] text-[var(--color-muted)]">
                      {formatRub(o.price, o.currency, rates)} ·{" "}
                      {new Date(o.at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <a
                    href={`/api/go/${encodeURIComponent(o.id)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="Открыть в магазине"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]"
                  >
                    <IconExternal className="h-[18px] w-[18px]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => forgetOrder(o.id)}
                    aria-label="Убрать из списка"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--color-muted)]"
                  >
                    <IconTrash className="h-[18px] w-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sourceLabel={providerLabel}
        catalogSize={catalog.size}
        baseCurrency={catalog.currency}
      />
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </p>
  );
}
