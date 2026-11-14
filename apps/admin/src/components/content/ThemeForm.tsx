"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

import { saveSiteAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";
import { THEME_SECTIONS, type ThemeSection, type ThemeValues } from "@/lib/theme-sections";

const COLORS: { name: "primaryColor" | "secondaryColor" | "backgroundColor" | "textColor"; label: string }[] = [
  { name: "primaryColor", label: "Ana renk (butonlar, başlıklar)" },
  { name: "secondaryColor", label: "İkincil renk (vurgu, rozetler)" },
  { name: "backgroundColor", label: "Zemin" },
  { name: "textColor", label: "Metin" },
];
const select = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

export function ThemeForm({
  section,
  initial,
  fonts,
  maxHeaderLinks,
  mediaBaseUrl,
}: {
  section: ThemeSection;
  initial: ThemeValues;
  fonts: string[];
  maxHeaderLinks: number;
  mediaBaseUrl: string;
}) {
  const { register, control, handleSubmit, setValue, formState } = useForm<ThemeValues>({ defaultValues: initial });
  const menu = useFieldArray({ control, name: "headerLinks" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // useWatch: renk önizlemesi yalnızca renkler değişince yeniden çizilir (watch() React Compiler ile uyumsuz)
  const colors = useWatch({ control, name: ["primaryColor", "secondaryColor", "backgroundColor", "textColor"] });
  const [primaryColor, secondaryColor, backgroundColor, textColor] = colors;

  async function submit(v: ThemeValues) {
    setError(null);
    setDone(false);
    // Yalnızca bu ekranın alanları gönderilir; diğer ayarlara dokunulmaz
    const body: Record<string, unknown> = Object.fromEntries(THEME_SECTIONS[section].fields.map((k) => [k, v[k]]));
    // Logo/favicon boş bırakılırsa mevcut değer korunur
    for (const k of ["logoUrl", "faviconUrl"] as const) if (k in body && !v[k]) delete body[k];
    const r = await saveSiteAction(body);
    if (!r.success) return setError(r.error);
    setDone(true);
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      {section === "header" && (
        <>
          <AreaCard title="Marka">
            <div className="grid gap-5 @xl:grid-cols-2">
              <FormField name="siteName" label="Mağaza adı" register={register} required />
              <div />
              <ImageUploadField name="logoUrl" label="Logo" control={control} mediaBaseUrl={mediaBaseUrl} />
              <ImageUploadField name="faviconUrl" label="Sekme simgesi (favicon)" control={control} mediaBaseUrl={mediaBaseUrl} description="Kare, en az 64×64 px." />
            </div>
          </AreaCard>
          <AreaCard
            title="Menü Linkleri"
            hint={`Logonun altındaki menü. Sıralama menüdeki sıradır; en fazla ${maxHeaderLinks} link. Hiç link yoksa menüde ürünü olan kategoriler gösterilir.`}
          >
            <div className="grid gap-3">
              {menu.fields.length === 0 && <p className="text-sm text-muted-foreground">Henüz link yok: menüde kategoriler gösteriliyor.</p>}
              {menu.fields.map((f, i) => (
                <div key={f.id} className="grid items-end gap-3 rounded-2xl border border-border p-3 @3xl:grid-cols-[220px_1fr_auto]">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Ad
                    <input {...register(`headerLinks.${i}.label`)} maxLength={30} placeholder="Ürünlerimiz" className={select} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Adres
                    <input {...register(`headerLinks.${i}.href`)} maxLength={300} inputMode="url" placeholder="/urunler" className={select} />
                  </label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. linki yukarı taşı`} disabled={i === 0} onClick={() => menu.move(i, i - 1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. linki aşağı taşı`} disabled={i === menu.fields.length - 1} onClick={() => menu.move(i, i + 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. linki kaldır`} onClick={() => menu.remove(i)} className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {menu.fields.length < maxHeaderLinks && (
                <div>
                  <Button type="button" variant="outline" onClick={() => menu.append({ label: "", href: "/" })} className="gap-2">
                    <Plus className="size-4" /> Link ekle
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Adres / ile başlayan site içi bir adres (ör. /kategori/baklava) veya https:// ile başlayan bir adres olmalı.</p>
            </div>
          </AreaCard>
          <AreaCard title="Duyuru Şeridi" hint="Sitenin en üstünde görünür. Boş bırakılırsa gösterilmez.">
            <div className="grid gap-5 @xl:grid-cols-2">
              <FormField name="announcementText" label="Metin" placeholder="500 ₺ üzeri kargo bedava" register={register} />
              <FormField name="announcementLink" label="Bağlantı (isteğe bağlı)" placeholder="/kampanyalar" register={register} description="/ ile başlayan site içi adres veya https:// adresi." />
            </div>
          </AreaCard>
        </>
      )}

      {section === "renkler" && (
        <AreaCard title="Renkler ve Yazı Tipleri" hint="Mağaza sitesinin tamamına uygulanır.">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {COLORS.map((c, i) => (
              <label key={c.name} className="flex flex-col gap-2 text-sm font-medium">
                {c.label}
                <span className="flex items-center gap-2">
                  <input type="color" aria-label={`${c.label} seçici`} value={colors[i]} onChange={(e) => setValue(c.name, e.target.value, { shouldDirty: true })} className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1" />
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
          <div className="mt-5 rounded-2xl border border-border p-5" style={{ background: backgroundColor, color: textColor }}>
            <p className="text-lg font-semibold">{initial.siteName || "Mağaza"}</p>
            <p className="mt-1 text-sm opacity-80">Önizleme: zemin, metin ve buton renkleri.</p>
            <span className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: primaryColor }}>
              Sepete Ekle
            </span>
            <span className="ml-2 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: secondaryColor, color: textColor }}>
              Yeni
            </span>
          </div>
        </AreaCard>
      )}

      {section === "arka-plan" && (
        <AreaCard title="Site Arka Planı (isteğe bağlı)">
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
      )}

      {section === "seo" && (
        <AreaCard title="Arama Motoru (SEO) Varsayılanları" hint="Kendi başlığı ve açıklaması olmayan sayfalarda kullanılır.">
          <div className="grid gap-5 @xl:grid-cols-2">
            <FormField name="metaTitle" label="Başlık (en fazla 70)" register={register} />
            <FormField name="metaDescription" label="Açıklama (en fazla 160)" register={register} />
            <ImageUploadField name="ogImageUrl" label="Paylaşım görseli (1200×630)" control={control} mediaBaseUrl={mediaBaseUrl} />
          </div>
        </AreaCard>
      )}

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
