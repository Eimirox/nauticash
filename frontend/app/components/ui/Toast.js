"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cx } from "./cx";

const ToastContext = createContext(null);

const TONES = {
  success: { cls: "border-gain/30", icon: "✓", iconCls: "bg-gain/15 text-gain" },
  error: { cls: "border-loss/30", icon: "!", iconCls: "bg-loss/15 text-loss" },
  info: { cls: "border-accent-2/30", icon: "i", iconCls: "bg-accent-2/15 text-accent-2" },
};

/**
 * Notifications (remplace alert). À placer une fois autour de l'application :
 *   <ToastProvider>{children}</ToastProvider>
 * puis dans un composant : const toast = useToast(); toast.success("Enregistré");
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone, message, { duration = 4000 } = {}) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-3), { id, tone, message }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useRef(null);
  api.current = {
    success: (m, o) => push("success", m, o),
    error: (m, o) => push("error", m, { duration: 6000, ...o }),
    info: (m, o) => push("info", m, o),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+var(--tabbar-h,0px))] z-[110] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((t) => {
          const tone = TONES[t.tone];
          return (
            <div
              key={t.id}
              className={cx(
                "animate-fade-in-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3 text-sm text-ink shadow-lg",
                tone.cls
              )}
            >
              <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", tone.iconCls)} aria-hidden="true">
                {tone.icon}
              </span>
              <p className="flex-1 pt-0.5">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fermer la notification"
                className="rounded-md px-1 text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx.current;
}
