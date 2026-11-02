"use client";
import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { syncOnLogin } from "@/lib/sync";
export default function AuthSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challenge ? { challenge, code } : { email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось войти");
      if (data.user) {
        useStore.getState().setAccount(data.user);
        await syncOnLogin();
        setCode("");
        setChallenge("");
        onClose();
      } else {
        setChallenge(data.challenge);
        setCode("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} title="Вход в Swiper" onClose={onClose}>
      <form
        className="space-y-4 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p>
          {challenge
            ? "Код отправлен на " + email
            : "Введите почту — пришлём код для входа или регистрации."}
        </p>
        {!challenge ? (
          <label className="block">
            Почта
            <input
              className="mt-2 w-full rounded-xl border p-3 text-black"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <label className="block">
            Код из письма
            <input
              className="mt-2 w-full rounded-xl border p-3 text-black"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="brand-gradient w-full rounded-xl p-3"
          disabled={busy}
        >
          {busy ? "Подождите…" : challenge ? "Войти" : "Получить код"}
        </button>
        {challenge && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setChallenge("");
              setCode("");
              setError("");
            }}
          >
            Изменить почту или запросить новый код
          </button>
        )}
      </form>
    </Sheet>
  );
}
