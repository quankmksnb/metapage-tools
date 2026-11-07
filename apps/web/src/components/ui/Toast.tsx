"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToastTone = "ok" | "err";
type ToastItem = { id: number; text: string; tone: ToastTone };

const ToastContext = createContext<{
  push: (text: string, tone?: ToastTone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, tone: ToastTone = "ok") => {
    const id = Date.now();
    setItems((prev) => [...prev.slice(-2), { id, text, tone }]);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      setItems((prev) => prev.slice(1));
    }, 5500);
    return () => clearTimeout(timer);
  }, [items]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => (
          <p
            key={t.id}
            className={t.tone === "ok" ? "toast toast-ok" : "toast toast-err"}
            role={t.tone === "err" ? "alert" : "status"}
          >
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast requires ToastProvider");
  return ctx;
}
