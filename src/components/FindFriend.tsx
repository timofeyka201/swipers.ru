"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
export default function FindFriend() {
  const account = useStore((s) => s.account);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    nickname: string;
    wishlistCode: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account?.nickname) return null;
  return (
    <section className="nickname-setup">
      <span className="profile-eyebrow">Друзья</span>
      <h2 className="font-display text-[22px]">Найти по никнейму</h2>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setResult(null);
          setError("");
          try {
            const r = await fetch(
              "/api/users?nickname=" + encodeURIComponent(query),
              { cache: "no-store" },
            );
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            if (useStore.getState().account?.id !== account.id) return;
            setResult(data.user);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Нет связи с сервером");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sr-only" htmlFor="find-nickname">
          Никнейм друга
        </label>
        <div className="nickname-field">
          <span aria-hidden="true">@</span>
          <input
            id="find-nickname"
            className="field"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nickname"
            required
            maxLength={25}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResult(null);
              setError("");
            }}
          />
        </div>
        <button className="action-secondary" disabled={busy}>
          {busy ? "Ищем…" : "Найти пользователя"}
        </button>
      </form>
      {error && (
        <p role="status" className="form-error">
          {error}
        </p>
      )}
      {result && (
        <div
          className="space-y-3 rounded-2xl bg-[var(--color-surface-2)] p-4"
          role="status"
        >
          <p className="text-[18px] font-bold">@{result.nickname}</p>
          {result.wishlistCode ? (
            <Link
              className="action-primary"
              href={"/wishlist/" + encodeURIComponent(result.wishlistCode)}
            >
              Открыть вишлист
            </Link>
          ) : (
            <p className="text-[13px] text-[var(--color-muted)]">
              Публичного вишлиста пока нет.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
