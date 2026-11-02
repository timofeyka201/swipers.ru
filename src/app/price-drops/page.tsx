"use client";
import { Header, Empty, BuyButton } from "@/components/Ui";
import { useSavedPrices } from "@/components/SavedProducts";
import { useHydrated, useStore } from "@/lib/store";
import { formatRub, toRub } from "@/lib/money";
import Img from "@/components/Img";
import Link from "next/link";
export default function Drops() {
  useSavedPrices();
  const s = useStore();
  const hydrated = useHydrated();
  if (!hydrated) return <div className="ui-loader" />;
  const source = [...s.liked, ...s.wishlist, ...s.cart.map((c) => c.product)];
  const drops = s.drops.filter((d) => source.some((p) => p.id === d.id));
  const total = drops.reduce(
    (sum, d) => sum + (toRub(d.was - d.now, d.currency, s.rates) ?? 0),
    0,
  );
  return (
    <main className="ui-page">
      <Header title="Подешевело" back="/likes" />
      <div className="ui-page-body">
        <p className="ui-muted">
          С тех пор как вы сохранили эти товары.
          <br />
          Цены в магазине могут измениться.
        </p>
        {drops.length ? (
          <>
            <div className="ui-savings-total">
              <span>Выгода сейчас</span>
              <strong>{formatRub(total, "RUB", s.rates)}</strong>
            </div>
            {drops.map((d) => {
              const p = source.find((x) => x.id === d.id)!;
              return (
                <section key={d.id} className="ui-box space-y-3">
                  <div className="ui-purchase-product">
                    <Img className="ui-image" src={d.image} alt="" />
                    <div>
                      <strong>{d.title}</strong>
                      <p>
                        <b>{formatRub(d.now, d.currency, s.rates)}</b>{" "}
                        <del className="ui-muted">
                          {formatRub(d.was, d.currency, s.rates)}
                        </del>
                      </p>
                      <span className="ui-drop-amount">
                        −{formatRub(d.was - d.now, d.currency, s.rates)}
                      </span>
                    </div>
                  </div>
                  <BuyButton product={{ ...p, price: d.now }} from="likes" />
                </section>
              );
            })}
          </>
        ) : (
          <Empty
            title="Пока без изменений"
            detail="Проверим цены ваших находок при следующем открытии."
          >
            <Link className="ui-btn ui-dark" href="/likes">
              К сохранённому
            </Link>
          </Empty>
        )}
      </div>
    </main>
  );
}
