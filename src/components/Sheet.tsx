"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowLeft, IconX } from "./Icons";
export default function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  fullScreen = false,
  hideHeader = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
  hideHeader?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(
      () =>
        ref.current
          ?.querySelector<HTMLElement>("input,button,a[href]")
          ?.focus(),
      50,
    );
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const fields = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select,textarea,a[href],[tabindex="0"]',
          ) ?? [],
        );
        const first = fields[0],
          last = fields.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={"ui-overlay " + (fullScreen ? "ui-overlay-full" : "")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title || "Вход по почте"}
            className={"ui-modal " + (fullScreen ? "ui-modal-full" : "")}
            initial={{ y: fullScreen ? 20 : 120 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!fullScreen && <span className="ui-modal-handle" />}
            {!hideHeader && (
              <div className="ui-modal-header">
                {fullScreen && (
                  <button
                    className="ui-round"
                    onClick={onClose}
                    aria-label="Назад"
                  >
                    <IconArrowLeft />
                  </button>
                )}
                {title ? <h2>{title}</h2> : <span className="flex-1" />}
                {!fullScreen && (
                  <button
                    className="ui-round"
                    onClick={onClose}
                    aria-label="Закрыть"
                  >
                    <IconX />
                  </button>
                )}
              </div>
            )}
            <div className="ui-modal-body">{children}</div>
            {footer && <div className="ui-modal-footer">{footer}</div>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
