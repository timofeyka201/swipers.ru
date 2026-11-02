"use client";
import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import Img from "./Img";
import { useStore } from "@/lib/store";
import { addCustomCard, patchItem } from "@/lib/wish/client";
import { safeUrl, type OwnerItem, type OwnerView } from "@/lib/wish/types";
import type { Product } from "@/lib/types";
export default function WishCardForm({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item?: OwnerItem | null;
  onClose: () => void;
  onSaved: (view: OwnerView) => void;
}) {
  const account = useStore((s) => s.account);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setUrl(item?.url ?? "");
      setTitle(item?.title ?? "");
      setPrice(item?.price !== undefined ? String(item.price) : "");
      setNote(item?.note ?? "");
      setImage(item?.image ?? "");
      setError("");
    }
  }, [open, item]);
  const preview = async () => {
    if (!account || !safeUrl(url)) return;
    const seq = ++request.current;
    setFetching(true);
    try {
      const r = await fetch(
        "/api/wishlist/preview?url=" + encodeURIComponent(safeUrl(url)!),
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (seq !== request.current) return;
      if (!title && data.title) setTitle(data.title);
      if (data.image) setImage(data.image);
      if (!price && typeof data.price === "number")
        setPrice(String(data.price));
    } catch {
      if (seq === request.current)
        setError(
          "Не удалось заполнить автоматически — укажите название и цену вручную.",
        );
    } finally {
      if (seq === request.current) setFetching(false);
    }
  };
  const save = async () => {
    if (busy) return;
    const name = title.trim();
    if (!name) {
      setError("Добавьте название желания");
      return;
    }
    const amount = price === "" ? undefined : Number(price.replace(",", "."));
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError("Укажите корректную цену");
      return;
    }
    if (url && !safeUrl(url)) {
      setError("Проверьте ссылку");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!account) {
        const p: Product = {
          id: item?.product?.id ?? item?.id ?? "custom-" + crypto.randomUUID(),
          url: safeUrl(url) ?? "",
          title: name,
          price: amount,
          currency: "RUB",
          images: image ? [image] : [],
          description: note,
          tiers: [],
          attributes: [],
          skus: [],
          reviews: [],
          source: "custom",
        };
        const s = useStore.getState();
        s.setWishlist(
          item
            ? s.wishlist.map((x) => (x.id === p.id ? p : x))
            : [p, ...s.wishlist],
        );
        useStore.setState({ updatedAt: Date.now() });
        onClose();
        return;
      }
      const result = item
        ? await patchItem(item.id, {
            title: name,
            price: amount ?? null,
            currency: item.currency || "RUB",
            url: safeUrl(url) ?? "",
            image,
            note,
          })
        : await addCustomCard({
            title: name,
            price: amount,
            currency: "RUB",
            url: safeUrl(url),
            image,
            note,
          });
      if (!result) throw new Error("Не удалось сохранить");
      const view = "items" in result ? result : result.wishlist;
      if (!view)
        throw new Error(
          "error" in result ? result.error : "Не удалось сохранить",
        );
      onSaved(view);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      title={item ? "Изменить желание" : "Своё желание"}
      fullScreen
      onClose={onClose}
      footer={
        <button
          className="ui-btn ui-dark"
          disabled={busy || fetching}
          onClick={() => void save()}
        >
          {busy ? "Сохраняем…" : item ? "Сохранить" : "Добавить в вишлист"}
        </button>
      }
    >
      <div className="ui-page-body">
        <p className="ui-muted">
          Вставьте ссылку с любого сайта или опишите желание вручную.
        </p>
        <label className="ui-field-label">
          Ссылка
          <input
            className="ui-input"
            type="url"
            placeholder="https://shop.example/item"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              request.current++;
            }}
            onBlur={() => void preview()}
          />
        </label>
        {(image || fetching) && (
          <div className="ui-purchase-product">
            {image && <Img className="ui-image" src={image} alt="" />}
            <p className="ui-muted">
              {fetching
                ? "Загружаем страницу…"
                : title || "Название со страницы"}
            </p>
          </div>
        )}
        <label className="ui-field-label">
          Название
          <input
            className="ui-input"
            required
            maxLength={120}
            placeholder="Название желания"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="ui-field-label">
          Цена, ₽
          <input
            className="ui-input"
            inputMode="decimal"
            placeholder="Необязательно"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="ui-field-label">
          Подсказка друзьям
          <textarea
            placeholder="Цвет, вариант, что важно"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {account && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFetching(true);
                try {
                  const form = new FormData();
                  form.append("photo", file);
                  const r = await fetch("/api/wishlist/photo", {
                    method: "POST",
                    body: form,
                  });
                  const data = await r.json();
                  if (!r.ok) throw new Error(data.error);
                  setImage(data.url);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Не удалось загрузить фото",
                  );
                } finally {
                  setFetching(false);
                  e.target.value = "";
                }
              }}
            />
            <button
              className="ui-btn ui-soft"
              disabled={fetching}
              onClick={() => input.current?.click()}
            >
              Прикрепить фото
            </button>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
