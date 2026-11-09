import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Minus } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { DATE_RE, getSalesReport } from "@/lib/reports";
import { formatPrice } from "@/lib/shop";

const TZ = "Europe/Istanbul";
const DAY = 86_400_000;
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const fmtDate = (d: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

function presets(today: string) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const prevMonthEnd = shift(monthStart, -1);
  return [
    { key: "bugun", label: "Bugün", from: today, to: today },
    { key: "7", label: "Son 7 gün", from: shift(today, -6), to: today },
    { key: "30", label: "Son 30 gün", from: shift(today, -29), to: today },
    { key: "bu-ay", label: "Bu ay", from: monthStart, to: today },
    { key: "gecen-ay", label: "Geçen ay", from: `${prevMonthEnd.slice(0, 7)}-01`, to: prevMonthEnd },
    { key: "bu-yil", label: "Bu yıl", from: `${y}-01-01`, to: today },
  ];
}

function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
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

function Tile({ label, value, delta, note }: { label: string; value: string; delta?: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1 min-h-4">{delta}</div>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; aralik?: string; grup?: string }> }) {
  const sp = await searchParams;
  const today = iso(new Date());
  const list = presets(today);
  const preset = list.find((p) => p.key === sp.aralik);
  const from = preset?.from ?? (typeof sp.from === "string" && DATE_RE.test(sp.from) ? sp.from : list[2].from);
  const to = preset?.to ?? (typeof sp.to === "string" && DATE_RE.test(sp.to) ? sp.to : today);
  const groupBy = ["day", "week", "month"].includes(sp.grup ?? "") ? sp.grup : undefined;
  const active = preset?.key ?? (sp.from || sp.to ? "" : "30");
  const result = await getSalesReport({ from, to, groupBy });
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-(--brand-primary) bg-(--brand-primary) text-white" : "border-border hover:bg-surface-muted"}`;

  return (
    <AreaShell
      icon={BarChart3}
      title="Satış Raporları"
      description="Ödemesi alınmış siparişler, ödeme tarihine göre (Türkiye saati). İadeler yapıldıkları tarihte düşülür."
      actions={
        <a href={`/reports/export?${new URLSearchParams({ from, to })}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold hover:bg-surface-muted">
          <Download className="size-4" /> CSV (muhasebe)
        </a>
      }
    >
      {/* Filtreler: tek satır */}
      <div className="flex flex-wrap items-center gap-2">
        {list.map((p) => (
          <Link key={p.key} href={`/reports?aralik=${p.key}`} className={chip(active === p.key)}>
            {p.label}
          </Link>
        ))}
        <form method="get" className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <label className="sr-only" htmlFor="from">Başlangıç</label>
          <input id="from" type="date" name="from" defaultValue={from} max={today} className="h-9 rounded-lg border border-border bg-surface px-2" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="to">Bitiş</label>
          <input id="to" type="date" name="to" defaultValue={to} max={today} className="h-9 rounded-lg border border-border bg-surface px-2" />
          <select name="grup" defaultValue={groupBy ?? ""} aria-label="Gruplama" className="h-9 rounded-lg border border-border bg-surface px-2">
            <option value="">Otomatik</option>
            <option value="day">Günlük</option>
            <option value="week">Haftalık</option>
            <option value="month">Aylık</option>
          </select>
          <button type="submit" className="h-9 rounded-lg bg-(--brand-primary) px-3 font-semibold text-white">
            Göster
          </button>
        </form>
      </div>

      {"error" in result ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error}
        </p>
      ) : (
        <Report r={result.report} />
      )}
    </AreaShell>
  );
}

function Report({ r }: { r: import("@/lib/reports").SalesReport }) {
  const s = r.summary;
  const unitLabel = { day: "günlük", week: "haftalık", month: "aylık" }[r.range.groupBy];
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {fmtDate(r.range.from)} – {fmtDate(r.range.to)} ({r.range.days} gün) · karşılaştırma: {fmtDate(r.previous.from)} – {fmtDate(r.previous.to)}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Net satış" value={formatPrice(s.net)} delta={<Delta value={r.change.net} />} note={s.refunds !== "0.00" ? `Brüt ${formatPrice(s.gross)} − iade ${formatPrice(s.refunds)}` : undefined} />
        <Tile label="Sipariş" value={s.orders.toLocaleString("tr-TR")} delta={<Delta value={r.change.orders} />} note={`${s.customers} farklı müşteri`} />
        <Tile label="Ortalama sepet" value={formatPrice(s.aov)} delta={<Delta value={r.change.aov} />} />
        <Tile label="Satılan ürün (adet)" value={s.itemsSold.toLocaleString("tr-TR")} delta={<Delta value={r.change.itemsSold} />} />
      </div>

      <AreaCard title={`Ciro (${unitLabel})`} hint="Sütunun üzerine gelin veya sekmeyle gezin: tutar ve sipariş sayısı.">
        {s.orders === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Bu aralıkta ödenmiş sipariş yok.</p>
        ) : (
          <RevenueChart data={r.series} unit={r.range.groupBy} />
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Tablo olarak göster</summary>
          <table className="mt-3 w-full max-w-lg text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Dönem</th>
                <th className="pb-2 text-right font-medium">Sipariş</th>
                <th className="pb-2 text-right font-medium">Ciro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {r.series.map((p) => (
                <tr key={p.date}>
                  <td className="py-1.5">{fmtDate(p.date)}</td>
                  <td className="py-1.5 text-right">{p.orders}</td>
                  <td className="py-1.5 text-right">{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </AreaCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <AreaCard title="En Çok Satan Ürünler" hint="Ciro: kupon indirimi öncesi satır tutarı.">
          <SimpleTable
            head={["Ürün", "Adet", "Sipariş", "Ciro"]}
            rows={r.topProducts.map((p) => [p.name, p.quantity.toLocaleString("tr-TR"), p.orders.toLocaleString("tr-TR"), formatPrice(p.revenue)])}
          />
        </AreaCard>
        <AreaCard title="Kategoriler">
          <SimpleTable head={["Kategori", "Adet", "Ciro"]} rows={r.categories.map((c) => [c.name, c.quantity.toLocaleString("tr-TR"), formatPrice(c.revenue)])} />
        </AreaCard>
        <AreaCard title="Kuponlar">
          <SimpleTable head={["Kod", "Kullanım", "İndirim", "Sipariş tutarı"]} rows={r.coupons.map((c) => [c.code, c.uses.toLocaleString("tr-TR"), formatPrice(c.discount), formatPrice(c.revenue)])} />
        </AreaCard>
        <AreaCard title="Ayrıntılar">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Ürün toplamı (indirim öncesi)</dt>
            <dd className="text-right">{formatPrice(s.subtotal)}</dd>
            <dt className="text-muted-foreground">Kupon indirimi</dt>
            <dd className="text-right">−{formatPrice(s.discount)}</dd>
            <dt className="text-muted-foreground">Kargo geliri</dt>
            <dd className="text-right">{formatPrice(s.shipping)}</dd>
            <dt className="text-muted-foreground">İçindeki KDV</dt>
            <dd className="text-right">{formatPrice(s.vat)}</dd>
            <dt className="text-muted-foreground">İade talebiyle iade ({s.returnCount})</dt>
            <dd className="text-right">−{formatPrice(s.returnRefunds)}</dd>
            <dt className="text-muted-foreground">Ödendikten sonra iptal ({s.cancelCount})</dt>
            <dd className="text-right">−{formatPrice(s.cancelRefunds)}</dd>
            <dt className="mt-2 border-t border-border pt-2 text-muted-foreground">Yeni / tekrar eden müşteri</dt>
            <dd className="mt-2 border-t border-border pt-2 text-right">
              {r.customers.new} / {r.customers.returning}
            </dd>
            <dt className="text-muted-foreground">Üye / misafir sipariş</dt>
            <dd className="text-right">
              {r.customers.memberOrders} / {r.customers.guestOrders}
            </dd>
            <dt className="mt-2 border-t border-border pt-2 text-muted-foreground">Oluşturulan sipariş</dt>
            <dd className="mt-2 border-t border-border pt-2 text-right">{r.funnel.created}</dd>
            <dt className="text-muted-foreground">Ödemesi tamamlanan</dt>
            <dd className="text-right">
              {r.funnel.paid}
              {r.funnel.conversion !== null && <span className="text-muted-foreground"> (%{r.funnel.conversion.toLocaleString("tr-TR")})</span>}
            </dd>
            <dt className="text-muted-foreground">Ödenmeden iptal / bekleyen</dt>
            <dd className="text-right">
              {r.funnel.abandoned} / {r.funnel.pending}
            </dd>
            <dt className="text-muted-foreground">Başarısız kart denemesi</dt>
            <dd className="text-right">{r.funnel.failedPayments}</dd>
          </dl>
        </AreaCard>
      </div>
    </>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Bu aralıkta veri yok.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`pb-2 font-medium ${i > 0 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={`py-2 ${j > 0 ? "text-right tabular-nums" : "font-medium"}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
