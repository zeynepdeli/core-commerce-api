"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { decideReturnAction, receiveReturnAction, refundReturnAction } from "@/app/actions/returns";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/send";
import type { ReturnStatus } from "@/lib/returns";

type Props = { id: string; status: ReturnStatus; autoRefund: boolean; refundTotal: string; refundInProgress: boolean };

export function ReturnActions({ id, status, autoRefund, refundTotal, refundInProgress }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.success) return setError(result.error);
      setNote("");
      router.refresh();
    });
  };

  const errorBox = error && (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
  const spinner = pending && <Loader2 className="size-4 animate-spin" />;

  if (status === "REQUESTED") {
    return (
      <div className="space-y-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Müşteriye not
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Onayda: kargo anlaşma kodu vb. Retde: gerekçe (zorunlu)"
            className="rounded-xl border border-border bg-surface p-3 text-sm"
          />
        </label>
        {errorBox}
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={pending} onClick={() => run(() => decideReturnAction(id, "approve", note))} className="min-h-11 gap-2 px-6">
            {spinner}Onayla
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => decideReturnAction(id, "reject", note))} className="min-h-11 px-6">
            Reddet
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Cayma hakkı gerekçe gerektirmez; ret yalnızca süre geçmiş, iade edilemez ürün ya da kullanılmış ürün gibi durumlarda yapılmalıdır.</p>
      </div>
    );
  }

  const refundButtons = (
    <div className="space-y-3">
      {refundInProgress && <p className="text-sm text-amber-800">İade işlemi sürüyor…</p>}
      <div className="flex flex-wrap gap-3">
        {autoRefund ? (
          <Button
            type="button"
            disabled={pending || refundInProgress}
            onClick={() => confirm(`${refundTotal.replace(".", ",")} ₺ müşterinin kartına iyzico üzerinden iade edilsin mi?`) && run(() => refundReturnAction(id, false))}
            className="min-h-11 gap-2 px-6"
          >
            {spinner}iyzico ile iade et
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending || refundInProgress}
            onClick={() => confirm("Ücreti müşteriye (havale vb.) elle iade ettiniz mi?") && run(() => refundReturnAction(id, true))}
            className="min-h-11 gap-2 px-6"
          >
            {spinner}Elle iade edildi olarak işaretle
          </Button>
        )}
      </div>
    </div>
  );

  if (status === "APPROVED") {
    return (
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-0.5 size-4" />
          <span>
            Ürün satılabilir durumda, stoğa geri ekle
            <span className="block text-xs text-muted-foreground">Hasarlı/açılmış ürünlerde kaldırın.</span>
          </span>
        </label>
        {errorBox}
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => receiveReturnAction(id, restock))} className="min-h-11 gap-2 px-6">
          {spinner}Ürün geldi
        </Button>
        <p className="text-xs text-muted-foreground">Yasal olarak ürün size ulaştıktan (veya müşteri gönderdiğini belgeledikten) sonra 14 gün içinde ücret iade edilmelidir.</p>
        {refundButtons}
      </div>
    );
  }

  if (status === "RECEIVED") {
    return (
      <div className="space-y-4">
        {errorBox}
        {refundButtons}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Bu talep için başka işlem yok.</p>;
}
