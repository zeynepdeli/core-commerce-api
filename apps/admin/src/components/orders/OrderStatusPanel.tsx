"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateOrderStatusAction } from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/orders";

const CARRIERS = ["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "UPS", "DHL", "Hepsijet", "Trendyol Express"];
const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

export function OrderStatusPanel({ orderId, next }: { orderId: string; next: { status: OrderStatus; label: string }[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<OrderStatus | "">(next[0]?.status ?? "");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (next.length === 0) return <p className="text-sm text-muted-foreground">Bu sipariş için başka işlem yok.</p>;

  function submit() {
    if (!target) return;
    if (target === "CANCELLED" && !confirm("Sipariş iptal edilsin mi? Stok geri eklenecek; kartla ödendiyse ücret iyzico üzerinden otomatik iade edilir.")) return;
    setError(null);
    start(async () => {
      const result = await updateOrderStatusAction(orderId, {
        status: target,
        note: note || undefined,
        ...(target === "SHIPPED" ? { shippingCarrier: carrier, trackingNumber: tracking } : {}),
      });
      if (!result.success) return setError(result.error);
      setNote("");
      setTracking("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Yeni durum
        <select value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)} className={input}>
          {next.map((n) => (
            <option key={n.status} value={n.status}>
              {n.label}
            </option>
          ))}
        </select>
      </label>
      {target === "SHIPPED" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Kargo firması
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={input}>
              {CARRIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Takip numarası
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} className={input} />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm font-medium">
        Not (isteğe bağlı{target === "CANCELLED" ? ", iptal nedeni" : ""})
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded-xl border border-border bg-surface p-3 text-sm" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" disabled={pending || !target} onClick={submit} variant={target === "CANCELLED" ? "destructive" : "default"} className="min-h-11 gap-2 px-6">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Durumu Güncelle
      </Button>
    </div>
  );
}
