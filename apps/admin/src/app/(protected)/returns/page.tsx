import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { ReturnBadge } from "@/components/returns/ReturnBadge";
import { RETURN_LABEL, getReturns, type ReturnStatus } from "@/lib/returns";
import { formatPrice } from "@/lib/shop";

const STATUSES = Object.keys(RETURN_LABEL) as ReturnStatus[];
const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; sayfa?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = STATUSES.includes(sp.durum as ReturnStatus) ? (sp.durum as ReturnStatus) : "";
  const page = Math.min(Math.max(Number.parseInt(sp.sayfa ?? "1", 10) || 1, 1), 10000);
  const result = await getReturns({ q, status, page });

  const href = (next: { durum?: string; sayfa?: number }) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    const d = next.durum ?? status;
    if (d) s.set("durum", d);
    if (next.sayfa && next.sayfa > 1) s.set("sayfa", String(next.sayfa));
    return `/returns${s.size ? `?${s}` : ""}`;
  };
  const allCount = Object.values(result.counts).reduce((a, b) => a + (b ?? 0), 0);
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-(--brand-primary) bg-(--brand-primary) text-white" : "border-border"}`;

  return (
    <AreaShell icon={RotateCcw} title="İade Talepleri" description="Müşterilerin cayma hakkı talepleri. Onaylayın, ürün gelince teslim alın, ücreti iade edin (kartla ödenmişse iyzico'dan otomatik).">
      <AreaCard title={`Talepler (${result.total})`}>
        <nav aria-label="Durum" className="mb-4 flex flex-wrap gap-2">
          <Link href={href({ durum: "" })} className={chip(!status)}>
            Tümü ({allCount})
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={href({ durum: s })} className={chip(status === s)}>
              {RETURN_LABEL[s]} ({result.counts[s] ?? 0})
            </Link>
          ))}
        </nav>
        <form method="get" className="mb-5 flex gap-3">
          {status && <input type="hidden" name="durum" value={status} />}
          <label className="relative flex-1">
            <span className="sr-only">İade ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} maxLength={100} placeholder="İade no, sipariş no veya e-posta" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-(--brand-primary) px-5 text-sm font-semibold text-white">
            Ara
          </button>
        </form>

        {result.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">İade talebi yok.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {result.items.map((r) => (
              <li key={r.id}>
                <Link href={`/returns/${r.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-surface-muted">
                  <span className="font-mono text-sm font-bold text-(--brand-primary)">{r.returnNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.order.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Sipariş {r.order.orderNumber} · {r.itemCount} ürün · {r.reasonLabel} · {fmt.format(new Date(r.createdAt))}
                    </span>
                  </span>
                  <ReturnBadge status={r.status} />
                  <span className="w-28 text-right font-semibold">{formatPrice(r.refundTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {result.pages > 1 && (
          <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between text-sm">
            {result.page > 1 ? <Link href={href({ sayfa: result.page - 1 })} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
            <span className="text-muted-foreground">Sayfa {result.page} / {result.pages}</span>
            {result.page < result.pages ? <Link href={href({ sayfa: result.page + 1 })} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
          </nav>
        )}
      </AreaCard>
    </AreaShell>
  );
}
