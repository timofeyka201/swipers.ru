"use client";
import { useState } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { formatCode } from "@/lib/wish/types";
export default function WishlistShare({
  open,
  code,
  onClose,
}: {
  open: boolean;
  code: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url =
    typeof window === "undefined"
      ? ""
      : window.location.origin + "/w/" + formatCode(code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(
        "Не удалось скопировать. Выделите ссылку и скопируйте её вручную.",
      );
    }
  };
  return (
    <Sheet open={open} title="Поделиться вишлистом" onClose={onClose}>
      <div className="ui-dialog-content">
        <p className="ui-muted">
          Друзья увидят список и смогут тайно забронировать подарок. Кто что
          дарит, вы не узнаете.
        </p>
        <div className="ui-wish-share-link">
          <span>{url}</span>
          <button onClick={() => void copy()}>
            {copied ? "Готово" : "Копировать"}
          </button>
        </div>
        <div className="ui-social-grid">
          <a
            href={"https://t.me/share/url?url=" + encodeURIComponent(url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>TG</b>Telegram
          </a>
          <a
            href={"https://wa.me/?text=" + encodeURIComponent(url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>WA</b>WhatsApp
          </a>
          <a
            href={"https://vk.com/share.php?url=" + encodeURIComponent(url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <b>VK</b>ВКонтакте
          </a>
          <button
            onClick={async () => {
              try {
                if (navigator.share)
                  await navigator.share({ title: "Мой вишлист", url });
                else await copy();
              } catch {}
            }}
          >
            <b>•••</b>Ещё
          </button>
        </div>
        <Link className="ui-text-button" href={"/wishlist/" + code}>
          Как это увидит друг
        </Link>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
