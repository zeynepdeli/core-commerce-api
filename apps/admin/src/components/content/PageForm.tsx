"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { savePageAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { Button } from "@/components/ui/button";

type Values = { title: string; slug: string; body: string; metaTitle: string; metaDescription: string; isPublished: boolean; showInFooter: boolean };

const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function PageForm({ id, initial, storefrontUrl }: { id: string | null; initial: Values; storefrontUrl: string }) {
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Values>({ defaultValues: initial });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const slug = watch("slug");

  async function submit(v: Values) {
    setError(null);
    setSaved(false);
    const r = await savePageAction(id, { ...v, metaTitle: v.metaTitle || null, metaDescription: v.metaDescription || null });
    if (!r.success) return setError(r.error);
    setSaved(true);
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      <AreaCard title="Sayfa">
        <div className="grid gap-5">
          <div className="grid gap-5 @xl:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Başlık
              <input
                {...register("title", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })}
                maxLength={120}
                className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Adres
              <input {...register("slug", { onChange: () => setSlugTouched(true) })} maxLength={80} className="min-h-11 rounded-xl border border-border bg-surface px-3 font-mono text-sm" />
              <span className="text-xs font-normal text-muted-foreground">
                {storefrontUrl}/sayfa/{slug || "…"}
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            İçerik
            <textarea {...register("body")} rows={18} maxLength={50000} className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-sm leading-6" />
            <span className="text-xs font-normal text-muted-foreground">Markdown: # Başlık, ## Alt başlık, **kalın**, *italik*, - liste, [bağlantı](/adres). HTML çalışmaz (güvenlik).</span>
          </label>
          <div className="grid gap-4 @xl:grid-cols-2">
            <FormSwitch name="isPublished" label="Yayında" description="Kapalıysa taslak olarak kalır, mağazada açılmaz." control={control} />
            <FormSwitch name="showInFooter" label="Alt bilgide göster" description="Sitenin en altındaki bağlantılarda yer alır." control={control} />
          </div>
        </div>
      </AreaCard>
      <AreaCard title="Arama Motoru (SEO)">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="metaTitle" label="Başlık (boşsa sayfa başlığı)" register={register} />
          <FormField name="metaDescription" label="Açıklama (en fazla 160)" register={register} />
        </div>
      </AreaCard>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Kaydedildi.
        </p>
      )}
      <div>
        <Button type="submit" disabled={formState.isSubmitting} className="min-h-11 gap-2 rounded-full px-7">
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {id ? "Kaydet" : "Sayfayı Oluştur"}
        </Button>
      </div>
    </form>
  );
}
