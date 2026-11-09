import Link from "next/link";
import { TicketPercent } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { CouponManager, type CouponRow } from "@/components/store/CouponManager";
import { formatPrice } from "@/lib/shop";
import { type Coupon, getCoupons } from "@/lib/store";

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
/** ISO → datetime-local değeri (Türkiye saati) */
const localInput = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Istanbul" }).slice(0, 16).replace(" ", "T") : "";
const priceInput = (v: string | null) => (v === null ? "" : v.replace(/\.00$/, "").replace(".", ","));

function status(c: Coupon, now: number): CouponRow["status"] {
  if (!c.isActive) return "inactive";
  if (c.endsAt && Date.parse(c.endsAt) <= now) return "expired";
  if (c.startsAt && Date.parse(c.startsAt) > now) return "scheduled";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "used-up";
  return "active";
}

function summary(c: Coupon) {
  const parts = [
    c.type === "PERCENT" ? `%${priceInput(c.value)} indirim` : c.type === "FIXED" ? `${formatPrice(c.value)} indirim` : "Kargo bedava",
  ];
  if (c.maxDiscount) parts.push(`en fazla ${formatPrice(c.maxDiscount)}`);
  if (c.minSubtotal) parts.push(`${formatPrice(c.minSubtotal)} ve üzeri`);
  if (c.perUserLimit) parts.push(`kişi başı ${c.perUserLimit}`);
  return parts.join(" · ");
}

function rows(items: Coupon[]): CouponRow[] {
  const now = Date.now();
  return items.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: priceInput(c.value),
    maxDiscount: priceInput(c.maxDiscount),
    minSubtotal: priceInput(c.minSubtotal),
    startsAt: localInput(c.startsAt),
    endsAt: localInput(c.endsAt),
    usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
    perUserLimit: c.perUserLimit === null ? "" : String(c.perUserLimit),
    isActive: c.isActive,
    usedCount: c.usedCount,
    summary: summary(c),
    period: c.startsAt || c.endsAt ? `${c.startsAt ? fmt.format(new Date(c.startsAt)) : "…"} – ${c.endsAt ? fmt.format(new Date(c.endsAt)) : "süresiz"}` : "Süresiz",
    status: status(c, now),
  }));
}

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ sayfa?: string }> }) {
  const { sayfa } = await searchParams;
  const page = Math.min(Math.max(Number.parseInt(sayfa ?? "1", 10) || 1, 1), 10000);
  const result = await getCoupons(page);
  return (
    <AreaShell icon={TicketPercent} title="Kupon Yönetimi" description="İndirim kodları: yüzde, sabit tutar veya kargo bedava; tarih, sepet tutarı ve kullanım sınırlarıyla.">
      <AreaCard title={`Kuponlar (${result.total})`}>
        <CouponManager coupons={rows(result.items)} />
        {result.pages > 1 && (
          <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between text-sm">
            {result.page > 1 ? <Link href={`/shop/coupons?sayfa=${result.page - 1}`} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
            <span className="text-muted-foreground">Sayfa {result.page} / {result.pages}</span>
            {result.page < result.pages ? <Link href={`/shop/coupons?sayfa=${result.page + 1}`} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
          </nav>
        )}
      </AreaCard>
    </AreaShell>
  );
}
