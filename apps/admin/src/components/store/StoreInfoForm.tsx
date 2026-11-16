"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CreditCard, Loader2, MessageCircle, Save } from "lucide-react";
import { z } from "zod";

import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/ui/button";
import { updateStoreInfoAction } from "@/app/actions/store";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { storeInfoSchema } from "@/lib/validations/store.schema";

type Values = z.input<typeof storeInfoSchema>;

export function StoreInfoForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(storeInfoSchema), defaultValues: initial });
  useUnsavedChanges(isDirty && !isSubmitting);
  const channel = useWatch({ control, name: "orderChannel" });

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
      <AreaCard title="Sipariş Kanalı" hint="Müşteri siparişi nasıl tamamlar. Değişiklik mağazanın ödeme sayfasına hemen yansır.">
        <fieldset className="grid gap-3 @xl:grid-cols-2">
          <legend className="sr-only">Sipariş kanalı</legend>
          {(
            [
              { value: "ONLINE_PAYMENT", icon: CreditCard, title: "Online ödeme (iyzico)", text: "Müşteri kartla öder (3D Secure, taksit). Ödeme alınınca sipariş kendiliğinden onaylanır." },
              { value: "WHATSAPP", icon: MessageCircle, title: "WhatsApp ile sipariş talebi", text: "Sipariş talep olarak oluşur, müşteri WhatsApp'a yönlendirilir. Ödemeyi alınca siparişi “Ödeme alındı” yaparsınız." },
            ] as const
          ).map((o) => (
            <label key={o.value} className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4 has-checked:border-primary has-checked:bg-primary/5">
              <input type="radio" value={o.value} {...register("orderChannel")} className="mt-1 size-4 accent-primary" />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <o.icon className="size-4" aria-hidden />
                  {o.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{o.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {channel === "WHATSAPP" ? (
          <div className="mt-5 grid gap-5 @xl:grid-cols-2">
            <FormField
              name="whatsappOrderPhone"
              label="WhatsApp numarası"
              placeholder="905321234567"
              register={register}
              error={errors.whatsappOrderPhone}
              description="Ülke koduyla, başında 0 ve + olmadan."
            />
            <FormField
              name="whatsappHoldHours"
              label="Stok ayırma süresi (saat)"
              type="number"
              register={register}
              error={errors.whatsappHoldHours}
              description="Bu sürede “Ödeme alındı” yapılmayan talep iptal edilir, stok geri eklenir."
            />
          </div>
        ) : (
          <div className="mt-5 max-w-xs">
            <FormField name="paymentTimeoutMinutes" label="Ödeme süresi (dakika)" type="number" register={register} error={errors.paymentTimeoutMinutes} description="Ödenmeyen sipariş bu süre sonunda iptal edilir, stok geri eklenir." />
          </div>
        )}
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
