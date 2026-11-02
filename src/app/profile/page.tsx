"use client";
import Link from "next/link";
import { useState } from "react";
import { Header, SectionLink } from "@/components/Ui";
import AuthSheet from "@/components/AuthSheet";
import Nickname from "@/components/Nickname";
import FindFriend from "@/components/FindFriend";
import Sheet from "@/components/Sheet";
import {
  IconUser,
  IconExit,
  IconChevron,
  IconMoon,
  IconGift,
  IconCheck,
} from "@/components/Icons";
import { useHydrated, useStore } from "@/lib/store";
import { flushPush } from "@/lib/sync";
import { toast } from "@/components/Toast";
export default function Profile() {
  const s = useStore();
  const hydrated = useHydrated();
  const [auth, setAuth] = useState(false);
  const [theme, setTheme] = useState(false);
  const [friends, setFriends] = useState(false);
  if (!hydrated) return <div className="ui-loader" />;
  const tags = Object.entries(s.taste.tags ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag]) => tag.split(":").at(-1));
  const categories = s.taste.picked.slice(0, 3);
  const chips = [...new Set([...tags, ...categories])].slice(0, 5);
  return (
    <div className="ui-page">
      <Header title="Профиль" />
      <div className="ui-page-body">
        {s.account ? (
          <div className="ui-profile-account">
            <span className="ui-profile-avatar">
              {(s.account.nickname ?? "Я")[0].toUpperCase()}
            </span>
            <div>
              <strong>
                {s.account.nickname
                  ? "@" + s.account.nickname
                  : "Выберите никнейм"}
              </strong>
              <small>{s.account.email}</small>
            </div>
            <button
              className="ui-round"
              aria-label="Выйти из аккаунта"
              onClick={async () => {
                await flushPush();
                try {
                  const r = await fetch("/api/auth/logout", { method: "POST" });
                  if (!r.ok) throw new Error();
                  s.setAccount(null);
                  toast("Вы вышли");
                } catch {
                  toast("Не удалось выйти. Проверьте связь");
                }
              }}
            >
              <IconExit />
            </button>
          </div>
        ) : (
          <button className="ui-profile-account" onClick={() => setAuth(true)}>
            <span className="ui-profile-avatar">
              <IconUser />
            </span>
            <span>
              <strong>Войти по почте</strong>
              <small>Сохранённое и вкус на всех устройствах</small>
            </span>
            <IconChevron />
          </button>
        )}
        <Nickname />
        <Link className="ui-box ui-profile-taste" href="/taste">
          <div>
            <strong>Мой вкус</strong>
            <span>Изменить</span>
          </div>
          <div className="ui-taste-chips">
            {chips.length ? (
              chips.map((tag) => (
                <span key={tag} className="positive">
                  {tag}
                </span>
              ))
            ) : (
              <span>Подстроим подборку под вас</span>
            )}
            {s.taste.budget && (
              <span>до {s.taste.budget.toLocaleString("ru-RU")} ₽</span>
            )}
          </div>
        </Link>
        <div className="ui-settings-group">
          <label className="ui-settings-row">
            <span className="ui-setting-icon">
              <IconCheck />
            </span>
            <span>Сообщать о снижении цены</span>
            <input
              type="checkbox"
              checked={s.priceAlerts}
              onChange={(e) => s.setPriceAlerts(e.target.checked)}
              aria-label="Сообщать о снижении цены"
            />
          </label>
          <button className="ui-settings-row" onClick={() => setTheme(true)}>
            <span className="ui-setting-icon">
              <IconMoon />
            </span>
            <span>Оформление</span>
            <small>
              {s.theme === "system"
                ? "Как в системе"
                : s.theme === "dark"
                  ? "Тёмное"
                  : "Светлое"}
            </small>
          </button>
          <SectionLink
            href="/about"
            title="Как это работает"
            icon={<span>?</span>}
          />
          {s.account?.nickname && (
            <button
              className="ui-settings-row"
              onClick={() => setFriends(true)}
            >
              <span className="ui-setting-icon">
                <IconUser />
              </span>
              <span>Найти друзей</span>
              <IconChevron />
            </button>
          )}
          <SectionLink
            href="/wishlist?gifts=1"
            title="Я дарю"
            icon={<IconGift />}
          />
        </div>
        <p className="ui-footer-note">
          Учитываем ваши свайпы и предпочтения,
          <br />
          чтобы подбирать товары.
          <br />
          <br />
          <Link href="/about">О сервисе</Link>
          <br />
          <Link href="/privacy">Данные и приватность</Link>
        </p>
      </div>
      <AuthSheet open={auth} onClose={() => setAuth(false)} />
      <Sheet open={theme} title="Оформление" onClose={() => setTheme(false)}>
        <div className="ui-dialog-content">
          {(
            [
              ["system", "Как в системе"],
              ["light", "Светлое"],
              ["dark", "Тёмное"],
            ] as const
          ).map(([id, title]) => (
            <button
              key={id}
              className={"ui-btn " + (s.theme === id ? "ui-dark" : "ui-soft")}
              onClick={() => {
                s.setTheme(id);
                setTheme(false);
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet
        open={friends}
        title="Найти друзей"
        fullScreen
        onClose={() => setFriends(false)}
      >
        <div className="ui-page-body">
          <FindFriend />
        </div>
      </Sheet>
    </div>
  );
}
