"use client";
import { syncOnLogin } from "@/lib/sync";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { nicknameProblem, normalizeNickname } from "@/lib/auth/nickname";
export default function Nickname({
  onComplete,
  registration,
  suggestedNickname,
}: {
  onComplete?: () => void;
  registration?: string;
  suggestedNickname?: string;
}) {
  const account = useStore((s) => s.account);
  const [nickname, setNickname] = useState(
    suggestedNickname ?? account?.name ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!registration && (!account || account.nickname)) return null;
  return (
    <form
      className="nickname-setup soft-shadow"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const problem = nicknameProblem(nickname);
        if (problem) {
          setError(problem);
          return;
        }
        setBusy(true);
        setError("");
        try {
          const r = await fetch("/api/auth/nickname", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nickname: normalizeNickname(nickname),
              registration,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Не удалось сохранить");
          if (!registration && useStore.getState().account?.id !== account?.id)
            return;
          useStore.getState().setAccount(d.user);
          if (registration) await syncOnLogin();
          onComplete?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Нет связи с сервером");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="profile-eyebrow">Ваш уникальный ник</span>
      <h2 className="font-display text-[22px]">Как вас найдут друзья?</h2>
      <p className="text-[13px] text-[var(--color-muted)]">
        Выберите один раз. После сохранения изменить никнейм нельзя.
      </p>
      <label
        className="block text-[13px] font-semibold"
        htmlFor="signup-nickname"
      >
        Никнейм
      </label>
      <div className="nickname-field">
        <span aria-hidden="true">@</span>
        <input
          id="signup-nickname"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          aria-describedby="nickname-help"
        />
      </div>
      <p id="nickname-help" className="text-[12px] text-[var(--color-muted)]">
        3–24 символа: a–z, 0–9 и _. Начните с буквы.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="action-primary" disabled={busy}>
        {busy ? "Сохраняем…" : "Закрепить никнейм"}
      </button>
    </form>
  );
}
