"use client";

import { useId, useState } from "react";

type Point = { date: string; orders: number; revenue: string };

const W = 960;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

/** Temiz eksen adımları: 1, 2, 2.5, 5 × 10^n */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function label(date: string, unit: "day" | "week" | "month", long = false) {
  const d = new Date(`${date}T12:00:00Z`);
  if (unit === "month") return new Intl.DateTimeFormat("tr-TR", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }).format(d);
  const f = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}), timeZone: "UTC" }).format(d);
  return unit === "week" && long ? `${f} haftası` : f;
}

/**
 * Tek seri sütun grafik (ciro). Tek renk (marka), ince sütunlar, 4px yuvarlak uç,
 * yatay ince ızgara. Fareyle / klavyeyle her sütunun değeri; tablo görünümü ayrıca var.
 */
export function RevenueChart({ data, unit }: { data: Point[]; unit: "day" | "week" | "month" }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const values = data.map((d) => Number(d.revenue));
  const ticks = niceTicks(Math.max(...values, 0));
  const top = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  // viewBox geniş ekranda ~1.4x büyür: 17 birim ≈ 24px üst sınır
  const barW = Math.min(17, Math.max(2, band - 2));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const every = Math.max(1, Math.ceil(data.length / 10));
  const a = active === null ? null : data[active];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId} onMouseLeave={() => setActive(null)}>
        <title id={titleId}>Dönem cirosu grafiği</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
              {t >= 10_000 ? compact.format(t) : t.toLocaleString("tr-TR")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = values[i];
          const x = PAD.left + i * band + (band - barW) / 2;
          const h = Math.max(0, y(0) - y(v));
          const r = Math.min(4, barW / 2, h);
          // Üst köşeler yuvarlak, taban düz
          const path = h > 0 ? `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${y(0)} Z` : "";
          return (
            <g key={d.date}>
              {path && <path d={path} fill="var(--color-primary)" opacity={active === null || active === i ? 1 : 0.45} />}
              {/* Geniş tıklama/hover alanı: sütunun tüm şeridi */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${label(d.date, unit, true)}: ${money.format(v)}, ${d.orders} sipariş`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
              {i % every === 0 && (
                <text x={PAD.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {label(d.date, unit)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-muted-foreground)" strokeOpacity={0.4} strokeWidth={1} />
      </svg>
      {a && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((PAD.left + active * band + band / 2) / W) * 100}%` }}
        >
          <p className="font-semibold text-foreground">{money.format(Number(a.revenue))}</p>
          <p className="text-muted-foreground">
            {label(a.date, unit, true)} · {a.orders} sipariş
          </p>
        </div>
      )}
    </div>
  );
}
