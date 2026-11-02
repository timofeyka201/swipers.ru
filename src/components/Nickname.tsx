"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
export default function Nickname() {
  const account = useStore((s) => s.account);
  const [name, setName] = useState(account?.name ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(account?.name ?? "");
    setMessage("");
  }, [account?.id, account?.name]);
  if (!account) return null;
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/auth/nickname", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: name }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error();
          if (useStore.getState().account?.id !== account.id) return;
          useStore.getState().setAccount(d.user);
          setMessage("Сохранено");
        } catch {
          setMessage("Не удалось сохранить");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Никнейм
        <input
          className="block w-full rounded-xl p-3 text-black"
          autoComplete="nickname"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button disabled={busy}>Сохранить никнейм</button>
      <p role="status">{message}</p>
    </form>
  );
}
