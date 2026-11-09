import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { z } from "zod";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { OrderStatusPanel } from "@/components/orders/OrderStatusPanel";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { getOrder, type Address } from "@/lib/orders";
import { formatPrice } from "@/lib/shop";

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const DOC_TITLE: Record<string, string> = { PRE_INFORMATION: "Ön Bilgilendirme Formu", DISTANCE_SALES: "Mesafeli Satış Sözleşmesi" };

function AddressBlock({ a }: { a: Pick<Address, "addressLine" | "district" | "city"> & Partial<Address> }) {
  return (
    <p className="text-sm leading-6">
      {a.fullName && <span className="block font-medium">{a.fullName}</span>}
      {a.addressLine}
      <br />
      {a.district} / {a.city} {a.zipCode ?? ""}
      {a.phone && <span className="block text-muted-foreground">{a.phone}</span>}
    </p>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await getOrder(id);
  if (!o) notFound();
  const b = o.billingInfo;

  return (
    <AreaShell
      icon={ShoppingBag}
      title={`Sipariş ${o.orderNumber}`}
      description={`${fmt.format(new Date(o.createdAt))} · ${o.customer ? "Üye" : "Misafir"} · ${o.email}`}
      back={{ href: "/orders", label: "Sipariş Yönetimi" }}
      actions={<StatusBadge status={o.status} />}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <AreaCard title="Ürünler">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Ürün</th>
                  <th className="pb-2 text-right font-medium">Adet</th>
                  <th className="pb-2 text-right font-medium">Birim</th>
                  <th className="pb-2 text-right font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {o.items.map((i, index) => (
                  <tr key={index}>
                    <td className="py-2">
                      <span className="font-medium">{i.productName}</span> <span className="text-muted-foreground">· {i.variantName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i.sku ? `SKU ${i.sku} · ` : ""}KDV %{i.vatRate}
                      </span>
                    </td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">{formatPrice(i.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatPrice(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Ara toplam</dt>
              <dd className="text-right">{formatPrice(o.subtotal)}</dd>
              {o.discount !== "0.00" && (
                <>
                  <dt className="text-muted-foreground">İndirim {o.couponCode && `(${o.couponCode})`}</dt>
                  <dd className="text-right">−{formatPrice(o.discount)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Kargo</dt>
              <dd className="text-right">{o.shippingFee === "0.00" ? "Ücretsiz" : formatPrice(o.shippingFee)}</dd>
              <dt className="font-semibold">Toplam</dt>
              <dd className="text-right font-semibold">{formatPrice(o.total)}</dd>
              <dt className="text-xs text-muted-foreground">İçindeki KDV</dt>
              <dd className="text-right text-xs text-muted-foreground">{formatPrice(o.vatTotal)}</dd>
            </dl>
          </AreaCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <AreaCard title="Teslimat Adresi">
              <AddressBlock a={o.shippingAddress} />
              {o.customerNote && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Müşteri notu: {o.customerNote}</p>}
            </AreaCard>
            <AreaCard title="Fatura Bilgileri">
              <p className="text-sm leading-6">
                <span className="block font-medium">{b.type === "CORPORATE" ? b.companyName : b.fullName}</span>
                {b.type === "CORPORATE" ? `${b.taxOffice} V.D. · VKN ${b.taxNumber}` : b.identityNumber ? `TCKN ${b.identityNumber}` : "Bireysel"}
              </p>
              {b.addressLine && <AddressBlock a={{ addressLine: b.addressLine, district: b.district ?? "", city: b.city ?? "" }} />}
            </AreaCard>
          </div>

          <AreaCard title="Onaylanan Sözleşmeler" hint="Müşterinin onayladığı metnin o anki hali; özet (SHA-256) metnin sonradan değişmediğini kanıtlar.">
            <ul className="space-y-3">
              {o.agreements.map((a) => (
                <li key={a.type} className="rounded-2xl border border-border p-4 text-sm">
                  <details>
                    <summary className="cursor-pointer font-medium">
                      {DOC_TITLE[a.type] ?? a.type} · {a.version === 0 ? "varsayılan şablon" : `sürüm ${a.version}`} · {fmt.format(new Date(a.acceptedAt))}
                      {a.ipAddress && <span className="text-muted-foreground"> · IP {a.ipAddress}</span>}
                    </summary>
                    <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">SHA-256 {a.contentHash}</p>
                    <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-3 font-sans text-xs leading-5">{a.content}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </AreaCard>
        </div>

        <div className="space-y-5">
          <AreaCard title="Durum">
            {o.status === "PENDING" && o.paymentDueAt && (
              <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Ödeme bekleniyor. {fmt.format(new Date(o.paymentDueAt))} saatine kadar ödenmezse otomatik iptal edilir. Havale/EFT ile ödendiyse &quot;Ödeme alındı&quot; seçin.
              </p>
            )}
            {o.trackingNumber && (
              <p className="mb-4 text-sm">
                {o.shippingCarrier} · <span className="font-mono">{o.trackingNumber}</span>
              </p>
            )}
            {o.cancelReason && <p className="mb-4 text-sm text-muted-foreground">İptal nedeni: {o.cancelReason}</p>}
            <OrderStatusPanel key={o.status} orderId={o.id} next={o.nextStatuses} />
          </AreaCard>

          <AreaCard title="Müşteri">
            <p className="text-sm leading-6">
              {o.customer ? <span className="block font-medium">{o.customer.name}</span> : <span className="block font-medium">Misafir</span>}
              {o.email}
              <br />
              {o.phone}
            </p>
          </AreaCard>

          <AreaCard title="Zaman Çizelgesi">
            <ol className="space-y-3 border-l border-border pl-4">
              {o.timeline.map((e, index) => (
                <li key={index} className="text-sm">
                  <StatusBadge status={e.status} />
                  <span className="ml-2 text-xs text-muted-foreground">{fmt.format(new Date(e.at))}</span>
                  {(e.note || e.actor) && (
                    <p className="mt-1 text-muted-foreground">
                      {e.note}
                      {e.actor && <span className="text-xs"> — {e.actor}</span>}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </AreaCard>
        </div>
      </div>
    </AreaShell>
  );
}
