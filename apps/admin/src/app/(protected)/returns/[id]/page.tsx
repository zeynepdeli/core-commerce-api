import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { z } from "zod";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { ReturnActions } from "@/components/returns/ReturnActions";
import { ReturnBadge } from "@/components/returns/ReturnBadge";
import { getReturn } from "@/lib/returns";
import { formatPrice } from "@/lib/shop";

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getReturn(id);
  if (!r) notFound();

  const timeline = [
    { label: "Talep oluşturuldu", at: r.createdAt },
    r.decidedAt && { label: r.status === "REJECTED" ? "Reddedildi" : "Onaylandı", at: r.decidedAt },
    r.receivedAt && { label: `Ürün teslim alındı${r.restocked ? " · stoğa eklendi" : ""}`, at: r.receivedAt },
    r.refundedAt && { label: `Ücret iade edildi (${r.refundMethod === "iyzico" ? "iyzico" : "elle"})`, at: r.refundedAt },
  ].filter(Boolean) as { label: string; at: string }[];

  return (
    <AreaShell
      icon={RotateCcw}
      title={`İade ${r.returnNumber}`}
      description={`${r.order.shippingAddress.fullName ?? ""} · ${r.order.email} · ${r.reasonLabel}`}
      back={{ href: "/returns", label: "İade Talepleri" }}
      actions={<ReturnBadge status={r.status} />}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <AreaCard title="İade Edilen Ürünler">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Ürün</th>
                  <th className="pb-2 text-right font-medium">Adet</th>
                  <th className="pb-2 text-right font-medium">İade tutarı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.items.map((i) => (
                  <tr key={i.orderItemId}>
                    <td className="py-2">
                      <span className="font-medium">{i.productName}</span> <span className="text-muted-foreground">· {i.variantName}</span>
                      {i.sku && <span className="block text-xs text-muted-foreground">SKU {i.sku}</span>}
                    </td>
                    <td className="py-2 text-right">
                      {i.quantity} <span className="text-xs text-muted-foreground">/ {i.orderedQuantity}</span>
                    </td>
                    <td className="py-2 text-right font-medium">{formatPrice(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
              {r.refundShipping !== "0.00" && (
                <>
                  <dt className="text-muted-foreground">Kargo ücreti</dt>
                  <dd className="text-right">{formatPrice(r.refundShipping)}</dd>
                </>
              )}
              <dt className="font-semibold">Toplam iade</dt>
              <dd className="text-right font-semibold">{formatPrice(r.refundTotal)}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Tutarlar kupon indirimi düşülmüş ödenen tutardır. Siparişin tamamı iade edilirse ilk kargo ücreti de iade edilir (yasal zorunluluk).</p>
          </AreaCard>

          {r.customerNote && (
            <AreaCard title="Müşterinin Açıklaması">
              <p className="whitespace-pre-line text-sm">{r.customerNote}</p>
            </AreaCard>
          )}

          <AreaCard title="Geçmiş">
            <ol className="space-y-2 text-sm">
              {timeline.map((t) => (
                <li key={t.label} className="flex justify-between gap-4">
                  <span>{t.label}</span>
                  <span className="text-muted-foreground">{fmt.format(new Date(t.at))}</span>
                </li>
              ))}
            </ol>
            {r.adminNote && <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">Müşteriye not: {r.adminNote}</p>}
          </AreaCard>
        </div>

        <div className="space-y-5">
          <AreaCard title="İşlem">
            {r.refundError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">Son iade denemesi başarısız: {r.refundError}</p>}
            <ReturnActions key={r.status} id={r.id} status={r.status} autoRefund={r.autoRefund} refundTotal={r.refundTotal} refundInProgress={r.refundInProgress} />
          </AreaCard>
          <AreaCard title="Sipariş">
            <p className="text-sm leading-6">
              <Link href={`/orders/${r.order.id}`} className="font-mono font-semibold text-(--brand-accent)">
                {r.order.orderNumber}
              </Link>
              <br />
              {r.order.email} · {r.order.phone}
              {r.order.deliveredAt && <span className="block text-muted-foreground">Teslim: {fmt.format(new Date(r.order.deliveredAt))}</span>}
            </p>
          </AreaCard>
        </div>
      </div>
    </AreaShell>
  );
}
