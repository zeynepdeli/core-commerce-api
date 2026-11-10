"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";

import { saveSiteAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";

type Values = {
  siteName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string;
  faviconUrl: string;
  backgroundImageUrl: string;
  backgroundImageFit: string;
  cardTextureUrl: string;
  ogImageUrl: string;
  announcementText: string;
  announcementLink: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactAddress: string;
  workingHours: string;
  metaTitle: string;
  metaDescription: string;
  social: Record<string, string>;
};

const COLORS: { name: keyof Values; label: string }[] = [
  { name: "primaryColor", label: "Ana renk (butonlar, başlıklar)" },
  { name: "secondaryColor", label: "İkincil renk (vurgu, rozetler)" },
  { name: "backgroundColor", label: "Zemin" },
  { name: "textColor", label: "Metin" },
];
const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", x: "X (Twitter)", youtube: "YouTube", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn" };
const select = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

export function ThemeForm({ initial, fonts, networks, mediaBaseUrl }: { initial: Values; fonts: string[]; networks: string[]; mediaBaseUrl: string }) {
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Values>({ defaultValues: initial });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(v: Values) {
    setError(null);
    setDone(false);
    const { social, ...rest } = v;
    // Logo/favicon boş bırakılırsa mevcut değer korunur
    const body: Record<string, unknown> = { ...rest, socialLinks: social };
    for (const k of ["logoUrl", "faviconUrl"] as const) if (!rest[k]) delete body[k];
    const r = await saveSiteAction(body);
    if (!r.success) return setError(r.error);
    setDone(true);
  }

  const w = watch();

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      <AreaCard title="Marka">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="siteName" label="Mağaza adı" register={register} required />
          <div />
          <ImageUploadField name="logoUrl" label="Logo" control={control} mediaBaseUrl={mediaBaseUrl} />
          <ImageUploadField name="faviconUrl" label="Sekme simgesi (favicon)" control={control} mediaBaseUrl={mediaBaseUrl} description="Kare, en az 64×64 px." />
        </div>
      </AreaCard>

      <AreaCard title="Renkler ve Yazı Tipleri" hint="Mağaza sitesinin tamamına uygulanır.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {COLORS.map((c) => (
            <label key={c.name} className="flex flex-col gap-2 text-sm font-medium">
              {c.label}
              <span className="flex items-center gap-2">
                <input type="color" aria-label={`${c.label} seçici`} value={String(w[c.name])} onChange={(e) => setValue(c.name, e.target.value as never, { shouldDirty: true })} className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1" />
                <input {...register(c.name)} maxLength={7} className={`${select} font-mono uppercase`} />
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(["fontHeading", "fontBody"] as const).map((f) => (
            <label key={f} className="flex flex-col gap-2 text-sm font-medium">
              {f === "fontHeading" ? "Başlık yazı tipi" : "Metin yazı tipi"}
              <select {...register(f)} className={select}>
                {fonts.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {/* Canlı önizleme: yalnızca renkler (yazı tipleri mağazada yüklenir) */}
        <div className="mt-5 rounded-2xl border border-border p-5" style={{ background: w.backgroundColor, color: w.textColor }}>
          <p className="text-lg font-semibold">{w.siteName || "Mağaza"}</p>
          <p className="mt-1 text-sm opacity-80">Önizleme: zemin, metin ve buton renkleri.</p>
          <span className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: w.primaryColor }}>
            Sepete Ekle
          </span>
          <span className="ml-2 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: w.secondaryColor, color: w.textColor }}>
            Yeni
          </span>
        </div>
      </AreaCard>

      <AreaCard title="Arka Plan (isteğe bağlı)">
        <div className="grid gap-5 @xl:grid-cols-2">
          <ImageUploadField name="backgroundImageUrl" label="Sayfa arka plan görseli" control={control} mediaBaseUrl={mediaBaseUrl} />
          <ImageUploadField name="cardTextureUrl" label="Kart dokusu" control={control} mediaBaseUrl={mediaBaseUrl} />
          <label className="flex flex-col gap-2 text-sm font-medium">
            Arka plan yerleşimi
            <select {...register("backgroundImageFit")} className={select}>
              <option value="cover">Kapla</option>
              <option value="contain">Sığdır</option>
              <option value="repeat">Döşe (tekrarla)</option>
            </select>
          </label>
        </div>
      </AreaCard>

      <AreaCard title="Duyuru Şeridi" hint="Sitenin en üstünde görünür. Boş bırakılırsa gösterilmez.">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="announcementText" label="Metin" placeholder="500 ₺ üzeri kargo bedava" register={register} />
          <FormField name="announcementLink" label="Bağlantı (isteğe bağlı)" placeholder="/kampanyalar" register={register} description="/ ile başlayan site içi adres veya https:// adresi." />
        </div>
      </AreaCard>

      <AreaCard title="İletişim ve Sosyal Medya">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="contactEmail" label="E-posta" register={register} />
          <FormField name="contactPhone" label="Telefon" register={register} />
          <FormField name="contactWhatsapp" label="WhatsApp (ülke koduyla)" placeholder="905321234567" register={register} />
          <FormField name="workingHours" label="Çalışma saatleri" placeholder="Hafta içi 09:00–18:00" register={register} />
        </div>
        <div className="mt-5">
          <FormTextarea name="contactAddress" label="Adres" rows={2} register={register} />
        </div>
        <div className="mt-5 grid gap-5 @xl:grid-cols-2">
          {networks.map((n) => (
            <label key={n} className="flex flex-col gap-2 text-sm font-medium">
              {SOCIAL_LABEL[n] ?? n}
              <input {...register(`social.${n}` as const)} placeholder={`https://www.${n === "x" ? "x" : n}.com/…`} className={select} />
            </label>
          ))}
        </div>
      </AreaCard>

      <AreaCard title="Arama Motoru (SEO) Varsayılanları">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="metaTitle" label="Başlık (en fazla 70)" register={register} />
          <FormField name="metaDescription" label="Açıklama (en fazla 160)" register={register} />
          <ImageUploadField name="ogImageUrl" label="Paylaşım görseli (1200×630)" control={control} mediaBaseUrl={mediaBaseUrl} />
        </div>
      </AreaCard>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" /> Kaydedildi. Mağaza en geç 1 dakika içinde güncellenir.
        </p>
      )}
      <div>
        <Button type="submit" disabled={formState.isSubmitting} className="min-h-11 gap-2 rounded-full px-7">
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
