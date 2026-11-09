"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

type OrderButtonsProps = {
  index: number;
  total: number;
  disabled?: boolean;
  onMove: (direction: -1 | 1) => void;
  size?: "sm" | "md";
  layout?: "row" | "column";
};

/** Listelerde "yukarı / aşağı taşı" butonları */
export function OrderButtons({
  index,
  total,
  disabled = false,
  onMove,
  size = "md",
  layout = "column",
}: OrderButtonsProps) {
  const box = size === "sm" ? "size-7" : "size-8";
  const icon = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className={`flex gap-1 ${layout === "column" ? "sm:flex-col" : ""}`}>
      <button
        type="button"
        aria-label="Yukarı taşı"
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        className={`inline-flex ${box} items-center justify-center rounded-lg border border-border hover:bg-surface-muted disabled:opacity-30`}
      >
        <ArrowUp className={icon} />
      </button>
      <button
        type="button"
        aria-label="Aşağı taşı"
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
        className={`inline-flex ${box} items-center justify-center rounded-lg border border-border hover:bg-surface-muted disabled:opacity-30`}
      >
        <ArrowDown className={icon} />
      </button>
    </div>
  );
}

/** Dizideki iki öğenin yerini değiştirip yeni id sırasını döndürür */
export function swapIds(ids: string[], index: number, direction: -1 | 1) {
  const next = [...ids];
  const target = index + direction;
  if (target < 0 || target >= next.length) return null;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
