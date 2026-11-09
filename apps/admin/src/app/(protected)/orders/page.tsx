import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { STATUS_LABEL, getOrders, type OrderStatus } from "@/lib/orders";
import { formatPrice } from "@/lib/shop";

const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; sayfa?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = STATUSES.includes(sp.durum as OrderStatus) ? (sp.durum as OrderStatus) : "";
  const page = Math.min(Math.max(Number.parseInt(sp.sayfa ?? "1", 10) || 1, 1), 10000);
  const result = await getOrders({ q, status, page });

  const href = (next: { durum?: string; sayfa?: number }) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    const d = next.durum ?? status;
    if (d) s.set("durum", d);
    if (next.sayfa && next.sayfa > 1) s.set("sayfa", String(next.sayfa));
    return `/orders${s.size ? `?${s}` : ""}`;
  };
  const allCount = Object.values(result.statusCounts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <AreaShell icon={ShoppingBag} title="Sipariş Yönetimi" description="Siparişler, durumları ve kargo bilgileri. Ödenmeyen siparişler süresi dolunca otomatik iptal edilir ve stok geri eklenir.">
      <AreaCard title={`Siparişler (${result.total})`}>
        <nav aria-label="Durum" className="mb-4 flex flex-wrap gap-2">
          <Link href={href({ durum: "" })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${!status ? "border-(--brand-primary) bg-(--brand-primary) text-white" : "border-border"}`}>
            Tümü ({allCount})
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={href({ durum: s })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status === s ? "border-(--brand-primary) bg-(--brand-primary) text-white" : "border-border"}`}>
              {STATUS_LABEL[s]} ({result.statusCounts[s] ?? 0})
            </Link>
          ))}
        </nav>
        <form method="get" className="mb-5 flex gap-3">
          {status && <input type="hidden" name="durum" value={status} />}
          <label className="relative flex-1">
            <span className="sr-only">Sipariş ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} maxLength={100} placeholder="Sipariş no, e-posta veya ad" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-(--brand-primary) px-5 text-sm font-semibold text-white">
            Ara
          </button>
        </form>

        {result.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Sipariş yok.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {result.items.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-surface-muted">
                  <span className="font-mono text-sm font-bold text-(--brand-primary)">{o.orderNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {o.customerName} {o.guest && <span className="ml-1 text-xs font-normal text-muted-foreground">(misafir)</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.email} · {o.itemCount} ürün · {fmt.format(new Date(o.createdAt))}
                    </span>
                  </span>
                  <StatusBadge status={o.status} />
                  <span className="w-28 text-right font-semibold">{formatPrice(o.total)}</span>
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
