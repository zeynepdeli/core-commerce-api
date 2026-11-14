"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { z } from "zod";

import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/ui/button";
import { updateStoreInfoAction } from "@/app/actions/store";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { storeInfoSchema } from "@/lib/validations/store.schema";

type Values = z.infer<typeof storeInfoSchema>;

export function StoreInfoForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(storeInfoSchema), defaultValues: initial });
  useUnsavedChanges(isDirty && !isSubmitting);

  async function submit(values: Values) {
    setError(null);
    setSaved(false);
    const result = await updateStoreInfoAction(values);
    if (!result.success) return setError(result.error);
    reset(values);
    setSaved(true);
    router.refresh();
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-5">
      <AreaCard title="Satıcı Bilgileri" hint="Sitenin alt kısmında, Ön Bilgilendirme Formu'nda ve Mesafeli Satış Sözleşmesi'nde gösterilir (yasal zorunluluk). Vergi numarası, MERSİS numarası girilmişse sitede gösterilmez.">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="sellerName" label="Ticari Unvan" placeholder="Örnek Gıda Ltd. Şti." register={register} error={errors.sellerName} />
          <FormField name="sellerEmail" label="E-posta" register={register} error={errors.sellerEmail} />
          <FormField name="sellerPhone" label="Telefon" register={register} error={errors.sellerPhone} />
          <FormField name="sellerTaxOffice" label="Vergi Dairesi" register={register} error={errors.sellerTaxOffice} />
          <FormField name="sellerTaxNumber" label="Vergi No (VKN/TCKN)" register={register} error={errors.sellerTaxNumber} />
          <FormField name="sellerMersisNo" label="MERSİS No" register={register} error={errors.sellerMersisNo} />
          <FormField name="sellerKepAddress" label="KEP Adresi" placeholder="unvan@hs01.kep.tr" register={register} error={errors.sellerKepAddress} description="Tebligata elverişli kayıtlı elektronik posta adresi." />
        </div>
        <div className="mt-5">
          <FormTextarea name="sellerAddress" label="Adres" rows={2} register={register} error={errors.sellerAddress} />
        </div>
      </AreaCard>
      <AreaCard title="Ödeme Süresi" hint="Ödenmeyen sipariş bu süre sonunda otomatik iptal edilir ve stok geri eklenir.">
        <div className="max-w-xs">
          <FormField name="paymentTimeoutMinutes" label="Süre (dakika)" type="number" register={register} error={errors.paymentTimeoutMinutes} />
        </div>
      </AreaCard>
      <AreaCard title="Cayma (İade) Süresi" hint="Müşteri teslimden itibaren bu kadar gün içinde iade talep edebilir. Yasal alt sınır 14 gündür; sözleşmelere otomatik yazılır. İade adresi olarak yukarıdaki adres kullanılır.">
        <div className="max-w-xs">
          <FormField name="returnWindowDays" label="Süre (gün)" type="number" register={register} error={errors.returnWindowDays} />
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
          Kaydet
        </Button>
      </div>
    </form>
  );
}
