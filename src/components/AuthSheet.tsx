"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import Nickname from "./Nickname";
import { useStore } from "@/lib/store";
import { syncOnLogin } from "@/lib/sync";
import { IconCheck } from "./Icons";
export default function AuthSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const account = useStore((s) => s.account);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [registration, setRegistration] = useState("");
  const [suggestedNickname, setSuggestedNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const saved = useStore(
    (s) =>
      new Set([
        ...s.liked.map((p) => p.id),
        ...s.wishlist.map((p) => p.id),
        ...s.cart.map((c) => c.product.id),
      ]).size,
  );
  useEffect(() => {
    if (!challenge) return;
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((sentAt + 60000 - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [challenge, sentAt]);
  const request = async (confirm = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { challenge, code } : { email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось войти");
      if (data.registration) {
        setRegistration(data.registration);
        setSuggestedNickname(data.suggestedNickname ?? "");
        setChallenge("");
        setCode("");
      } else if (data.user) {
        useStore.getState().setAccount(data.user);
        await syncOnLogin();
        setChallenge("");
        setCode("");
        onClose();
      } else {
        setChallenge(data.challenge);
        setCode("");
        setSentAt(Date.now());
        setTimeout(() => inputs.current[0]?.focus(), 100);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };
  if (registration || (account && !account.nickname))
    return (
      <Sheet open={open} fullScreen title="Ваш никнейм" onClose={onClose}>
        <div className="ui-page-body">
          <Nickname
            registration={registration || undefined}
            suggestedNickname={suggestedNickname || undefined}
            onComplete={() => {
              setRegistration("");
              onClose();
            }}
          />
          {registration && (
            <button
              className="ui-text-button"
              onClick={() => {
                setRegistration("");
                setChallenge("");
                setCode("");
                setError("");
              }}
            >
              Изменить почту
            </button>
          )}
        </div>
      </Sheet>
    );
  return (
    <Sheet open={open} fullScreen title="" onClose={onClose}>
      <form
        className="ui-login-content"
        onSubmit={(e) => {
          e.preventDefault();
          void request(!!challenge);
        }}
      >
        <h1>{challenge ? "Код из письма" : "Вход по почте"}</h1>
        <p className="ui-muted">
          {challenge
            ? "Отправили 6 цифр на " + email + ". Пароль не нужен."
            : "Пришлём код на почту. Пароль не нужен."}
        </p>
        {!challenge ? (
          <label className="ui-field-label">
            <span className="ui-label">Почта</span>
            <input
              className="ui-input"
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <>
            <div className="ui-otp">
              {Array.from({ length: 6 }, (_, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  aria-label={"Цифра " + (i + 1)}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  value={code[i] ?? ""}
                  maxLength={i === 0 ? 6 : 1}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length > 1) {
                      setCode(value.slice(0, 6));
                      inputs.current[Math.min(5, value.length)]?.focus();
                      return;
                    }
                    const chars = code.padEnd(6, " ").split("");
                    chars[i] = value || " ";
                    setCode(chars.join("").trimEnd());
                    if (value) inputs.current[i + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i])
                      inputs.current[Math.max(0, i - 1)]?.focus();
                    if (e.key === "ArrowLeft")
                      inputs.current[Math.max(0, i - 1)]?.focus();
                    if (e.key === "ArrowRight")
                      inputs.current[Math.min(5, i + 1)]?.focus();
                  }}
                  onPaste={(e) => {
                    const value = e.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, 6);
                    if (value) {
                      e.preventDefault();
                      setCode(value);
                      inputs.current[Math.min(5, value.length)]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="ui-text-button"
              style={{ textAlign: "left", padding: 0 }}
              disabled={busy || seconds > 0}
              onClick={() => void request(false)}
            >
              {seconds
                ? "Отправить снова через " +
                  Math.floor(seconds / 60) +
                  ":" +
                  String(seconds % 60).padStart(2, "0")
                : "Отправить код снова"}
            </button>
            <button
              type="button"
              className="ui-text-button"
              style={{ textAlign: "left", padding: 0 }}
              onClick={() => {
                setChallenge("");
                setCode("");
                setError("");
              }}
            >
              Изменить почту
            </button>
          </>
        )}
        {saved > 0 && (
          <div className="ui-toast-note">
            <span>
              <IconCheck />
            </span>
            <p>{saved} сохранённых товаров и ваш вкус перенесём в аккаунт</p>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer>
          <p className="ui-legal">
            Почта нужна для входа.{" "}
            <Link href="/privacy">Как используются данные</Link>
          </p>
          <button
            className="ui-btn ui-dark"
            disabled={busy || (!!challenge && !/^\d{6}$/.test(code))}
          >
            {busy ? "Подождите…" : challenge ? "Войти" : "Получить код"}
          </button>
        </footer>
      </form>
    </Sheet>
  );
}
