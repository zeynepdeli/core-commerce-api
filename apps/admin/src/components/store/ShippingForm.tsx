"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { updateShippingAction } from "@/app/actions/store";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { shippingSchema, type ShippingFormValues } from "@/lib/validations/store.schema";

export function ShippingForm({ initial }: { initial: ShippingFormValues }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ShippingFormValues>({ resolver: zodResolver(shippingSchema), defaultValues: initial });
  useUnsavedChanges(isDirty && !isSubmitting);

  async function submit(values: ShippingFormValues) {
    setError(null);
    setSaved(false);
    const result = await updateShippingAction(values);
    if (!result.success) return setError(result.error);
    reset(values);
    setSaved(true);
    router.refresh();
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      <AreaCard title="Kargo Ücreti" hint="Tutarlar KDV dahil girilir. Sepet tutarı her zaman sunucuda hesaplanır.">
        <div className="grid gap-5 @xl:grid-cols-3">
          <FormField name="shippingFee" label="Kargo Ücreti (₺)" placeholder="49,90" description="Her zaman ücretsiz için 0 girin." register={register} error={errors.shippingFee} required />
          <FormField
            name="freeShippingThreshold"
            label="Ücretsiz Kargo Eşiği (₺)"
            placeholder="500"
            description="Sepet (indirim sonrası) bu tutara ulaşınca kargo ücretsiz. Boş = eşik yok."
            register={register}
            error={errors.freeShippingThreshold}
          />
          <FormField
            name="minOrderAmount"
            label="En Düşük Sipariş Tutarı (₺)"
            placeholder="100"
            description="Bu tutarın altında sipariş verilemez. Boş = sınır yok."
            register={register}
            error={errors.minOrderAmount}
          />
        </div>
      </AreaCard>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {saved && !isDirty && (
          <span role="status" className="mr-auto flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" />
            Kaydedildi
          </span>
        )}
        <Button type="submit" disabled={isSubmitting || !isDirty} className="min-h-11 gap-2 px-6">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Ayarları Kaydet
        </Button>
      </div>
    </form>
  );
}
