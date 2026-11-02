"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { IconArrowLeft, IconHeart, IconCart, IconChevron } from "./Icons";
import { safeUrl } from "@/lib/wish/types";
import { useStore } from "@/lib/store";
import { shopUrl, type ShopFrom } from "@/lib/shop";
import type { Product } from "@/lib/types";
import Img from "./Img";
import { formatRub } from "@/lib/money";
export function Header({
  title,
  back = "/",
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="ui-header safe-top">
      <Link href={back} className="ui-round" aria-label="Назад">
        <IconArrowLeft />
      </Link>
      <h1>{title}</h1>
      {action}
    </header>
  );
}
export function SavedTabs({
  active,
}: {
  active: "likes" | "cart" | "wishlist";
}) {
  return (
    <nav className="ui-tabs" aria-label="Сохранённое">
      {[
        ["likes", "Понравилось"],
        ["cart", "Куплю"],
        ["wishlist", "Вишлист"],
      ].map(([id, title]) => (
        <Link
          key={id}
          href={"/" + id}
          aria-current={active === id ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
export function SavedHeader({
  active,
  action,
}: {
  active: "likes" | "cart" | "wishlist";
  action?: ReactNode;
}) {
  return (
    <div className="ui-saved-header">
      <Header title="Сохранённое" action={action} />
      <SavedTabs active={active} />
    </div>
  );
}
export function Empty({
  title,
  detail,
  children,
  icon,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="ui-empty">
      <span className="ui-empty-icon">{icon ?? <IconHeart />}</span>
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      <div className="ui-empty-actions">{children}</div>
    </section>
  );
}
export function BuyButton({
  product,
  from = "item",
  children,
  className = "ui-btn ui-buy",
}: {
  product: Product;
  from?: ShopFrom;
  children?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  if (!safeUrl(product.url))
    return <span className="ui-muted">Без ссылки на магазин</span>;
  return (
    <a
      className={className}
      href={shopUrl(product, from)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const s = useStore.getState();
        s.addToCart(product);
        s.noteOrder(product);
        s.setPurchaseStatus(
          product.id,
          s.purchases[product.id] === "bought" ? "bought" : "opened",
        );
        s.setPendingPurchase({ id: product.id, at: Date.now() });
        router.push("/leaving");
      }}
    >
      {children ??
        (product.source === "ae"
          ? "Купить на AliExpress"
          : "Купить в магазине")}
    </a>
  );
}
export function ProductRow({
  product,
  onOpen,
  children,
  detail,
}: {
  product: Product;
  onOpen: () => void;
  children?: ReactNode;
  detail?: string;
}) {
  const rates = useStore((s) => s.rates);
  return (
    <article className="ui-product-row">
      <button
        className="ui-row-image"
        onClick={onOpen}
        aria-label={"Открыть: " + product.title}
      >
        <Img
          className="ui-image"
          src={product.images?.[0]}
          alt={product.title}
        />
      </button>
      <button className="ui-row-copy" onClick={onOpen}>
        <span>{product.title}</span>
        <strong>{formatRub(product.price, product.currency, rates)}</strong>
        {detail && <small>{detail}</small>}
      </button>
      {children && <div className="ui-row-actions">{children}</div>}
    </article>
  );
}
export function Avatar() {
  const account = useStore((s) => s.account);
  return (
    <Link className="ui-round ui-avatar" href="/profile" aria-label="Профиль">
      {(account?.nickname ?? "Я").slice(0, 1).toUpperCase()}
    </Link>
  );
}
export function SectionLink({
  href,
  title,
  detail,
  icon,
}: {
  href: string;
  title: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <Link href={href} className="ui-settings-row">
      <span className="ui-setting-icon">{icon ?? <IconCart />}</span>
      <span>{title}</span>
      {detail && <small>{detail}</small>}
      <IconChevron className="h-4 w-4" />
    </Link>
  );
}
