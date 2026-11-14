import { Megaphone } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { MarketingSettings } from "@/components/marketing/MarketingSettings";
import { getMarketingOverview } from "@/lib/marketing";
import { formatPrice } from "@/lib/shop";
import { getStoreSettings } from "@/lib/store";
import { envUrl } from "@/lib/env-url";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default async function MarketingPage() {
  const [o, s] = await Promise.all([getMarketingOverview(), getStoreSettings()]);
  const apiPublic = envUrl("API_PUBLIC_URL", "API_URL");

  return (
    <AreaShell icon={Megaphone} title="Pazarlama" description="Stok bildirimleri, sepet hatırlatmaları ve Google Alışveriş ürün akışı.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stok bildirimi (30 gün)" value={o.last30Days.stockAlertsSent.toLocaleString("tr-TR")} note="ürün stoğa girince giden e-posta" />
        <Stat label="Sepet hatırlatma (30 gün)" value={o.last30Days.cartRemindersSent.toLocaleString("tr-TR")} />
        <Stat label="Hatırlatma sonrası sipariş" value={o.last30Days.recoveredOrders.toLocaleString("tr-TR")} note={`7 gün içinde ödenen · ${formatPrice(o.last30Days.recoveredRevenue)}`} />
        <Stat label="E-posta izni olan kişi" value={o.emailOptIns.toLocaleString("tr-TR")} note="İYS: en son kaydı “izin verdi” olan" />
      </div>

      <AreaCard title="Ayarlar">
        <MarketingSettings
          abandonedCartEnabled={s.abandonedCartEnabled}
          abandonedCartDelayHours={s.abandonedCartDelayHours}
          productFeedEnabled={s.productFeedEnabled}
          feedBrand={s.feedBrand ?? ""}
          feedUrl={`${apiPublic}${o.feedPath}`}
        />
      </AreaCard>

      <AreaCard title="Stok Bekleyenler" hint="“Gelince haber ver” diyen müşteri sayısı. Stok girince otomatik e-posta gider (10 dakikada bir kontrol).">
        {o.stockDemand.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen talep yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Ürün</th>
                <th className="pb-2 text-right font-medium">Bekleyen</th>
                <th className="pb-2 text-right font-medium">Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.stockDemand.map((d) => (
                <tr key={d.variantId}>
                  <td className="py-2">
                    <span className="font-medium">{d.product}</span> <span className="text-muted-foreground">· {d.variant}</span>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{d.waiting}</td>
                  <td className="py-2 text-right tabular-nums">{d.trackStock ? d.stock : "takipsiz"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AreaCard>
    </AreaShell>
  );
}
