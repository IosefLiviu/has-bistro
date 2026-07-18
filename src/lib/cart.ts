"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "./types";

type CartState = {
  lines: CartLine[];
  lastAddedAt: number;
  add: (line: Omit<CartLine, "key"> & { key?: string }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      lastAddedAt: 0,
      add: (line) =>
        set((s) => {
          const key =
            line.key ??
            `${line.productId}__${line.options
              .map((o) => `${o.group}:${o.item}`)
              .sort()
              .join("|")}__${line.notes ?? ""}`;
          const existing = s.lines.find((l) => l.key === key);
          const lines = existing
            ? s.lines.map((l) =>
                l.key === key ? { ...l, qty: l.qty + line.qty } : l
              )
            : [...s.lines, { ...line, key }];
          return { lines, lastAddedAt: Date.now() };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.key !== key)
              : s.lines.map((l) => (l.key === key ? { ...l, qty } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: "hash-bistro-cart" }
  )
);

export function cartTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return { subtotal: Math.round(subtotal * 100) / 100, count };
}
