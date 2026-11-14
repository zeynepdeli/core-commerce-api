"use client";

import Link from "next/link";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

import { saveFooterAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { FooterIcon, FOOTER_ICON_META } from "@/components/content/FooterIcon";
import { FormField } from "@/components/forms/FormField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/ui/button";

type FooterLink = { icon: string; label: string; url: string };

export type FooterValues = {
  description: string;
  socialLinks: FooterLink[];
  pagesTitle: string;
  contactTitle: string;
  showCampaign: boolean;
  campaignTitle: string;
  campaignText: string;
  campaignButtonLabel: string;
  campaignButtonLink: string;
  copyrightText: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactAddress: string;
  workingHours: string;
  footerPageIds: string[];
};

type PageOption = { id: string; title: string; isPublished: boolean };

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";
const iconLabel = (icon: string) => FOOTER_ICON_META[icon]?.label ?? icon;

export function FooterForm({ initial, icons, maxLinks, pages, siteName }: { initial: FooterValues; icons: string[]; maxLinks: number; pages: PageOption[]; siteName: string }) {
  const { register, control, handleSubmit, setValue, getValues, formState } = useForm<FooterValues>({ defaultValues: initial });
  const { fields, append, remove, move } = useFieldArray({ control, name: "socialLinks" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // useWatch: yalnızca bu alanlar değişince yeniden çizer (watch() React Compiler ile uyumsuz)
  const showCampaign = useWatch({ control, name: "showCampaign" });
  const links = useWatch({ control, name: "socialLinks" });

  async function submit(v: FooterValues) {
    setError(null);
    setDone(false);
    // Hiç kutu işaretli değilse react-hook-form `false` döndürebilir: her zaman dizi gönder
    const footerPageIds = Array.isArray(v.footerPageIds) ? v.footerPageIds : v.footerPageIds ? [v.footerPageIds] : [];
    const r = await saveFooterAction({ ...v, footerPageIds });
    if (!r.success) return setError(r.error);
    setDone(true);
  }

  /** İkon değişince ad, önceki ikonun varsayılan adıysa (ya da boşsa) yeni ikonun adı olur */
  function changeIcon(index: number, next: string) {
    const prev = getValues(`socialLinks.${index}.icon`);
    const label = getValues(`socialLinks.${index}.label`);
    setValue(`socialLinks.${index}.icon`, next, { shouldDirty: true });
    if (!label.trim() || label === iconLabel(prev)) setValue(`socialLinks.${index}.label`, iconLabel(next), { shouldDirty: true });
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      <AreaCard title="Marka Metni" hint="Mağaza adının altında görünen kısa tanıtım. Boş bırakılırsa gösterilmez.">
        <FormTextarea name="description" label="Metin (en fazla 300 karakter)" rows={3} register={register} placeholder="Antep'in yöresel lezzetleri, kapınıza kadar." />
      </AreaCard>

      <AreaCard title="Sosyal Medya" hint={`Her bağlantı için ikon seçin. En fazla ${maxLinks} bağlantı; sıralama footer'daki sıradır.`}>
        <div className="grid gap-3">
          {fields.length === 0 && <p className="text-sm text-muted-foreground">Henüz bağlantı yok.</p>}
          {fields.map((f, i) => {
            const icon = links?.[i]?.icon ?? f.icon;
            return (
              <div key={f.id} className="grid items-end gap-3 rounded-2xl border border-border p-3 @3xl:grid-cols-[auto_200px_180px_1fr_auto]">
                <span className="flex size-11 items-center justify-center rounded-full bg-muted" title={iconLabel(icon)}>
                  <FooterIcon name={icon} className="size-5" />
                </span>
                <input type="hidden" {...register(`socialLinks.${i}.icon`)} />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  İkon
                  <select value={icon} onChange={(e) => changeIcon(i, e.target.value)} className={input}>
                    {icons.map((ic) => (
                      <option key={ic} value={ic}>
                        {iconLabel(ic)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Ad
                  <input {...register(`socialLinks.${i}.label`)} maxLength={40} className={input} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Adres
                  <input {...register(`socialLinks.${i}.url`)} type="url" inputMode="url" maxLength={300} placeholder={FOOTER_ICON_META[icon]?.placeholder} className={input} />
                </label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. bağlantıyı yukarı taşı`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. bağlantıyı aşağı taşı`} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. bağlantıyı kaldır`} onClick={() => remove(i)} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {fields.length < maxLinks && (
            <div>
              <Button type="button" variant="outline" onClick={() => append({ icon: icons[0], label: iconLabel(icons[0]), url: "" })} className="gap-2">
                <Plus className="size-4" /> Bağlantı ekle
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Güvenlik için marka ikonları yalnızca o markanın adresine bağlanabilir (ör. Instagram ikonu → instagram.com). Başka bir site için &quot;Web sitesi&quot; ikonunu seçin.
          </p>
        </div>
      </AreaCard>

      <AreaCard title="İletişim" hint="Bu bilgiler İletişim sayfasında ve müşteri e-postalarında da kullanılır.">
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField name="contactTitle" label="Sütun başlığı" register={register} required />
          <div />
          <FormField name="contactEmail" label="E-posta" type="email" register={register} />
          <FormField name="contactPhone" label="Telefon" register={register} />
          <FormField name="contactWhatsapp" label="WhatsApp (ülke koduyla)" placeholder="905321234567" register={register} />
          <FormField name="workingHours" label="Çalışma saatleri" placeholder="Hafta içi 09:00–18:00" register={register} />
        </div>
        <div className="mt-5">
          <FormTextarea name="contactAddress" label="Adres" rows={2} register={register} />
        </div>
      </AreaCard>

      <AreaCard title="Sayfalar" hint="Footer'da bağlantısı görünecek sayfaları seçin. Taslak sayfalar seçili olsa bile yayına alınana kadar görünmez.">
        <div className="grid gap-5">
          <FormField name="pagesTitle" label="Sütun başlığı" register={register} required />
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz sayfa yok.</p>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Görünecek sayfalar</legend>
              {pages.map((p) => (
                <label key={p.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
                  <input type="checkbox" value={p.id} {...register("footerPageIds")} className="size-4" />
                  <span className="flex-1">{p.title}</span>
                  {!p.isPublished && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Taslak</span>}
                </label>
              ))}
            </fieldset>
          )}
          <Link href="/content/pages" className="text-sm font-semibold text-(--brand-accent) hover:underline">
            Sayfaları düzenle ve sırala →
          </Link>
        </div>
      </AreaCard>

      <AreaCard title="Kampanya Kutusu" hint="Ziyaretçiyi üyeliğe yönlendirir. E-posta izinleri yalnızca üye hesabında, kayıt altında alınır (İYS / KVKK).">
        <div className="grid gap-5">
          <FormSwitch name="showCampaign" label="Göster" control={control} />
          {showCampaign && (
            <div className="grid gap-5 @xl:grid-cols-2">
              <FormField name="campaignTitle" label="Başlık" register={register} required />
              <FormField name="campaignButtonLabel" label="Buton yazısı" register={register} required />
              <FormTextarea name="campaignText" label="Metin (en fazla 200 karakter)" rows={2} register={register} />
              <FormField name="campaignButtonLink" label="Buton bağlantısı" register={register} required description="/ ile başlayan site içi adres veya https:// adresi." />
            </div>
          )}
        </div>
      </AreaCard>

      <AreaCard title="Alt Satır">
        <FormField name="copyrightText" label="Telif yazısı (isteğe bağlı)" register={register} placeholder={`© ${new Date().getFullYear()} ${siteName}. Tüm hakları saklıdır.`} description="Boş bırakılırsa yıl ve mağaza adı otomatik yazılır." />
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
