import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** Önceki döneme göre yüzde değişim (raporlar ve dashboard) */
export function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">önceki dönemde veri yok</span>;
  const up = value > 0;
  const good = inverse ? !up : up;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${value === 0 ? "text-muted-foreground" : good ? "text-emerald-700" : "text-red-700"}`}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {value.toLocaleString("tr-TR")}% <span className="font-normal text-muted-foreground">önceki döneme göre</span>
    </span>
  );
}
