"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { learnReason } from "@/lib/taste";
import Sheet from "./Sheet";
import Img from "./Img";
import { formatRub } from "@/lib/money";
export default function PurchasePrompt() {
  const path = usePathname();
  const pending = useStore((s) => s.pendingPurchase);
  const cart = useStore((s) => s.cart);
  const rates = useStore((s) => s.rates);
  const [open, setOpen] = useState(false);
  const product = cart.find((c) => c.product.id === pending?.id)?.product;
  useEffect(() => {
    const check = () => {
      if (
        pending &&
        Date.now() - pending.at > 1500 &&
        document.visibilityState === "visible"
      )
        setOpen(true);
    };
    const onVisible = () => check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    if (path !== "/leaving") check();
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pending, path]);
  const answer = (status: "bought" | "opened" | "dismissed") => {
    if (product) {
      const s = useStore.getState();
      s.setPurchaseStatus(
        product.id,
        status === "opened" && s.purchases[product.id] === "bought"
          ? "bought"
          : status,
      );
      if (status === "bought" && s.purchases[product.id] !== "bought")
        useStore.setState({
          taste: learnReason(s.taste, product, "have"),
          updatedAt: Date.now(),
        });
    }
    useStore.getState().setPendingPurchase(null);
    setOpen(false);
  };
  return (
    <Sheet
      open={open && !!product}
      title="Получилось купить?"
      onClose={() => answer("opened")}
    >
      {product && (
        <div className="ui-dialog-content">
          <div className="ui-purchase-product">
            <Img className="ui-image" src={product.images[0]} alt="" />
            <div>
              <strong>{product.title}</strong>
              <p>{formatRub(product.price, product.currency, rates)}</p>
            </div>
          </div>
          <p className="ui-muted">
            Ответ поможет подбирать точнее. Похожее после покупки покажем реже.
          </p>
          <button className="ui-btn ui-dark" onClick={() => answer("bought")}>
            Да, заказ оформлен
          </button>
          <button className="ui-btn ui-soft" onClick={() => answer("opened")}>
            Ещё думаю
          </button>
          <button
            className="ui-text-button"
            onClick={() => answer("dismissed")}
          >
            Нет, не буду брать
          </button>
        </div>
      )}
    </Sheet>
  );
}
