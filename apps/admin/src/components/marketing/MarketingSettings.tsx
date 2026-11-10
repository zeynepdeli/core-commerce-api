"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";

import { runMarketingJobsAction, saveMarketingSettingsAction } from "@/app/actions/marketing";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Props = { abandonedCartEnabled: boolean; abandonedCartDelayHours: number; productFeedEnabled: boolean; feedBrand: string; feedUrl: string };
const input = "min-h-11 rounded-xl border border-border bg-surface px-3 text-sm";

export function MarketingSettings(props: Props) {
  const router = useRouter();
  const [v, setV] = useState({ ...props });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveMarketingSettingsAction({ abandonedCartEnabled: v.abandonedCartEnabled, abandonedCartDelayHours: Number(v.abandonedCartDelayHours), productFeedEnabled: v.productFeedEnabled, feedBrand: v.feedBrand });
      setMsg(r.success ? { ok: true, text: "Kaydedildi." } : { ok: false, text: r.error });
      router.refresh();
    });

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block font-medium">Sepet hatırlatma e-postası</span>
            <span className="block text-sm text-muted-foreground">
              Sepette ürün bırakan ve e-posta ile ticari ileti izni (İYS) veren üyelere tek bir hatırlatma gider. İzni olmayana gönderilmez; her e-postada tek tıkla izinden çıkma bağlantısı vardır. Kişi başı en fazla haftada bir.
            </span>
          </span>
          <Switch checked={v.abandonedCartEnabled} onCheckedChange={(c) => setV({ ...v, abandonedCartEnabled: c })} aria-label="Sepet hatırlatma" />
        </label>
        <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">
          Sepet kaç saat hareketsiz kalınca
          <input type="number" min={1} max={72} value={v.abandonedCartDelayHours} onChange={(e) => setV({ ...v, abandonedCartDelayHours: Number(e.target.value) })} className={input} />
        </label>
      </section>

      <section className="grid gap-3 border-t border-border pt-6">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block font-medium">Google Merchant ürün akışı</span>
            <span className="block text-sm text-muted-foreground">
              Görseli olan, yayındaki ürünler Google Alışveriş&apos;e aktarılır (ad, açıklama, fiyat, indirim, stokta var/yok). Stok adedi paylaşılmaz.
            </span>
          </span>
          <Switch checked={v.productFeedEnabled} onCheckedChange={(c) => setV({ ...v, productFeedEnabled: c })} aria-label="Google ürün akışı" />
        </label>
        <label className="flex max-w-md flex-col gap-2 text-sm font-medium">
          Marka adı (boşsa satıcı unvanı)
          <input value={v.feedBrand} maxLength={70} onChange={(e) => setV({ ...v, feedBrand: e.target.value })} className={input} />
        </label>
        {props.productFeedEnabled && (
          <div className="flex max-w-2xl items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-surface-muted px-3 py-2.5 text-xs">{props.feedUrl}</code>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={async () => {
                await navigator.clipboard.writeText(props.feedUrl).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        )}
        {props.productFeedEnabled && <p className="text-xs text-muted-foreground">Merchant Center → Ürünler → Akışlar → &quot;Planlanmış getirme&quot; ile bu adresi ekleyin (günde bir getirme yeterli).</p>}
      </section>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={save} className="min-h-11 gap-2 px-6">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Kaydet
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await runMarketingJobsAction();
              setMsg(r.success ? { ok: true, text: "Bekleyen bildirimler ve hatırlatmalar gönderildi." } : { ok: false, text: r.error });
              router.refresh();
            })
          }
          className="min-h-11"
        >
          Şimdi çalıştır
        </Button>
      </div>
    </div>
  );
}
