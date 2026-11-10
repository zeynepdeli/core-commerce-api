"use client";

import { useState } from "react";
import { useFieldArray, useForm, type Control, type UseFormRegister } from "react-hook-form";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";

import { saveBlockAction, searchProductsAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";

/* eslint-disable @typescript-eslint/no-explicit-any -- bölüm verisi türe göre değişen bir JSON; API sınıf bazlı katı doğrular */
type Data = Record<string, any>;
type Props = {
  id: string | null;
  type: string;
  initial: Data;
  initialKey: string;
  categories: { id: string; name: string }[];
  productNames: Record<string, string>;
  icons: string[];
  mediaBaseUrl: string;
};

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";
const area = "w-full rounded-xl border border-border bg-surface p-3 text-sm";
const ICON_LABEL: Record<string, string> = { truck: "Kamyon (kargo)", shield: "Kalkan (güven)", gift: "Hediye", leaf: "Yaprak (doğal)", phone: "Telefon", refresh: "Yenile (iade)", star: "Yıldız", clock: "Saat", award: "Ödül", heart: "Kalp", "credit-card": "Kart", "map-pin": "Konum" };

function Text({ label, name, register, max, area: isArea, placeholder, hint }: { label: string; name: string; register: UseFormRegister<Data>; max: number; area?: boolean; placeholder?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {isArea ? <textarea {...register(name)} maxLength={max} rows={3} placeholder={placeholder} className={area} /> : <input {...register(name)} maxLength={max} placeholder={placeholder} className={input} />}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}
const LINK_HINT = "/ ile başlayan site içi adres (ör. /kategori/peynir) veya https:// adresi.";

/** Boş metinleri kaldır, tarihleri ISO'ya çevir (API boş alanı "yok" sayar) */
function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== null && x !== undefined).map(([k, x]) => [k, clean(x)]));
  return typeof v === "string" ? v.trim() : v;
}

export function BlockEditor({ id, type, initial, initialKey, categories, productNames, icons, mediaBaseUrl }: Props) {
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Data>({ defaultValues: { key: initialKey, ...initial, visibleFrom: toLocal(initial.visibleFrom), visibleUntil: toLocal(initial.visibleUntil) } });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(v: Data) {
    setError(null);
    setSaved(false);
    const { key, ...data } = v;
    // Tek kategori varsa onay kutusu dizi yerine değer/boolean döner: her zaman diziye çevir
    if (type === "CATEGORY_GRID") data.categoryIds = (Array.isArray(data.categoryIds) ? data.categoryIds : typeof data.categoryIds === "string" ? [data.categoryIds] : []).filter((x: unknown) => typeof x === "string" && x);
    const body = clean({ ...data, type, visibleFrom: fromLocal(v.visibleFrom), visibleUntil: fromLocal(v.visibleUntil), ...(data.limit ? { limit: Number(data.limit) } : {}) }) as Data;
    const r = await saveBlockAction(id, { ...(key ? { key } : {}), data: body });
    if (!r.success) return setError(r.error);
    setSaved(true);
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      {type === "HERO" && <HeroFields control={control} register={register} mediaBaseUrl={mediaBaseUrl} />}
      {type === "BANNER" && (
        <AreaCard title="Banner">
          <div className="grid gap-5 @xl:grid-cols-2">
            <ImageUploadField name="imageUrl" label="Görsel (masaüstü)" control={control} mediaBaseUrl={mediaBaseUrl} required />
            <ImageUploadField name="mobileImageUrl" label="Görsel (mobil, isteğe bağlı)" control={control} mediaBaseUrl={mediaBaseUrl} />
            <Text label="Başlık" name="heading" register={register} max={80} />
            <Text label="Görsel açıklaması (alt metin)" name="alt" register={register} max={150} />
            <Text label="Metin" name="text" register={register} max={200} area />
            <div className="grid gap-5">
              <Text label="Buton yazısı" name="buttonLabel" register={register} max={30} />
              <Text label="Bağlantı" name="link" register={register} max={500} hint={LINK_HINT} />
            </div>
          </div>
        </AreaCard>
      )}
      {type === "PRODUCT_LIST" && <ProductListFields register={register} watch={watch} setValue={setValue} categories={categories} productNames={productNames} />}
      {type === "CATEGORY_GRID" && (
        <AreaCard title="Kategoriler" hint="Hiçbiri seçilmezse tüm aktif kategoriler (en fazla 12) gösterilir.">
          <div className="grid gap-5">
            <Text label="Başlık" name="title" register={register} max={80} />
            <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <legend className="mb-2 text-sm font-medium">Gösterilecek kategoriler (en fazla 12)</legend>
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={c.id} {...register("categoryIds")} className="size-4" /> {c.name}
                </label>
              ))}
            </fieldset>
          </div>
        </AreaCard>
      )}
      {type === "TEXT" && (
        <AreaCard title="Metin" hint="Markdown: **kalın**, *italik*, # başlık, - liste, [bağlantı](/adres). HTML çalışmaz.">
          <div className="grid gap-5">
            <Text label="Başlık" name="title" register={register} max={80} />
            <label className="flex flex-col gap-2 text-sm font-medium">
              İçerik
              <textarea {...register("body")} rows={10} maxLength={10000} className={`${area} font-mono`} />
            </label>
          </div>
        </AreaCard>
      )}
      {type === "FEATURES" && <FeatureFields control={control} register={register} icons={icons} />}

      <AreaCard title="Yayın" hint="Kampanya bölümleri belirli tarihler arasında otomatik görünsün (Türkiye saati). Boş = her zaman.">
        <div className="grid gap-5 @xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Başlangıç
            <input type="datetime-local" {...register("visibleFrom")} className={input} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Bitiş
            <input type="datetime-local" {...register("visibleUntil")} className={input} />
          </label>
          <Text label="Bölüm anahtarı (isteğe bağlı)" name="key" register={register} max={60} hint="Mağaza tasarımında bu bölüme özel stil için. Küçük harf ve tire." />
        </div>
      </AreaCard>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Kaydedildi. Mağaza en geç 1 dakika içinde güncellenir.
        </p>
      )}
      <div>
        <Button type="submit" disabled={formState.isSubmitting} className="min-h-11 gap-2 rounded-full px-7">
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {id ? "Kaydet" : "Bölümü Ekle"}
        </Button>
      </div>
    </form>
  );
}

/** datetime-local (Türkiye saati) ↔ ISO */
function toLocal(iso: unknown) {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(Date.parse(iso) + 3 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
function fromLocal(local: unknown) {
  if (typeof local !== "string" || !local) return "";
  return new Date(`${local}:00+03:00`).toISOString();
}

function HeroFields({ control, register, mediaBaseUrl }: { control: Control<Data>; register: UseFormRegister<Data>; mediaBaseUrl: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: "slides" });
  return (
    <AreaCard title="Slaytlar" hint="En fazla 5. Birden fazlaysa slayt gösterisi olur.">
      <div className="grid gap-5">
        {fields.map((f, i) => (
          <fieldset key={f.id} className="grid gap-5 rounded-2xl border border-border p-4 @xl:grid-cols-2">
            <legend className="px-2 text-sm font-semibold">Slayt {i + 1}</legend>
            <ImageUploadField name={`slides.${i}.imageUrl`} label="Görsel (masaüstü)" control={control} mediaBaseUrl={mediaBaseUrl} required />
            <ImageUploadField name={`slides.${i}.mobileImageUrl`} label="Görsel (mobil, isteğe bağlı)" control={control} mediaBaseUrl={mediaBaseUrl} />
            <Text label="Başlık" name={`slides.${i}.heading`} register={register} max={80} />
            <Text label="Görsel açıklaması (alt metin)" name={`slides.${i}.alt`} register={register} max={150} />
            <Text label="Metin" name={`slides.${i}.text`} register={register} max={200} area />
            <div className="grid gap-5">
              <Text label="Buton yazısı" name={`slides.${i}.buttonLabel`} register={register} max={30} />
              <Text label="Buton bağlantısı" name={`slides.${i}.buttonLink`} register={register} max={500} hint={LINK_HINT} />
            </div>
            {fields.length > 1 && (
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="gap-1.5 text-destructive">
                  <Trash2 className="size-4" /> Slaytı kaldır
                </Button>
              </div>
            )}
          </fieldset>
        ))}
        {fields.length < 5 && (
          <div>
            <Button type="button" variant="outline" onClick={() => append({ imageUrl: "" })} className="gap-2">
              <Plus className="size-4" /> Slayt ekle
            </Button>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("autoplay")} className="size-4" /> Otomatik geçiş
        </label>
      </div>
    </AreaCard>
  );
}

function FeatureFields({ control, register, icons }: { control: Control<Data>; register: UseFormRegister<Data>; icons: string[] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  return (
    <AreaCard title="Avantajlar" hint="Ör. Hızlı kargo, Güvenli ödeme, Doğal ürün. En fazla 6.">
      <div className="grid gap-4">
        <Text label="Başlık (isteğe bağlı)" name="title" register={register} max={80} />
        {fields.map((f, i) => (
          <div key={f.id} className="grid items-end gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[180px_1fr_1fr_auto]">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Simge
              <select {...register(`items.${i}.icon`)} className={input}>
                {icons.map((ic) => (
                  <option key={ic} value={ic}>
                    {ICON_LABEL[ic] ?? ic}
                  </option>
                ))}
              </select>
            </label>
            <Text label="Başlık" name={`items.${i}.title`} register={register} max={40} />
            <Text label="Açıklama" name={`items.${i}.text`} register={register} max={120} />
            <Button type="button" variant="ghost" size="icon" aria-label="Kaldır" onClick={() => remove(i)} disabled={fields.length === 1} className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {fields.length < 6 && (
          <div>
            <Button type="button" variant="outline" onClick={() => append({ icon: icons[0], title: "" })} className="gap-2">
              <Plus className="size-4" /> Ekle
            </Button>
          </div>
        )}
      </div>
    </AreaCard>
  );
}

function ProductListFields({ register, watch, setValue, categories, productNames }: { register: UseFormRegister<Data>; watch: (n: string) => any; setValue: (n: string, v: any) => void; categories: { id: string; name: string }[]; productNames: Record<string, string> }) {
  const source = watch("source");
  const selected: string[] = watch("productIds") ?? [];
  const [names, setNames] = useState<Record<string, string>>(productNames);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    setResults(await searchProductsAction(q));
    setSearching(false);
  }

  return (
    <AreaCard title="Ürün Listesi">
      <div className="grid gap-5">
        <div className="grid gap-5 @xl:grid-cols-2">
          <Text label="Başlık" name="title" register={register} max={80} placeholder="Çok satanlar" />
          <Text label="Alt başlık" name="subtitle" register={register} max={200} />
          <label className="flex flex-col gap-2 text-sm font-medium">
            Hangi ürünler
            <select {...register("source")} className={input}>
              <option value="featured">Öne çıkan ürünler</option>
              <option value="new">En yeniler</option>
              <option value="bestsellers">Çok satanlar (son 30 gün)</option>
              <option value="rating">En beğenilenler (puan)</option>
              <option value="category">Bir kategoriden</option>
              <option value="manual">Elle seçilenler</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Kaç ürün
            <input type="number" min={1} max={24} {...register("limit")} className={input} />
          </label>
          {source === "category" && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Kategori
              <select {...register("categoryId")} className={input}>
                <option value="">Seçin</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Text label="Buton yazısı" name="buttonLabel" register={register} max={30} placeholder="Tümünü gör" />
          <Text label="Buton bağlantısı" name="buttonLink" register={register} max={500} hint={LINK_HINT} />
        </div>
        {source === "manual" && (
          <div className="grid gap-3">
            <p className="text-sm font-medium">Seçilen ürünler (sırasıyla, en fazla 24)</p>
            <ol className="flex flex-wrap gap-2">
              {selected.map((pid) => (
                <li key={pid} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-sm">
                  {names[pid] ?? "Ürün"}
                  <button type="button" aria-label={`${names[pid] ?? "Ürün"} kaldır`} onClick={() => setValue("productIds", selected.filter((x) => x !== pid))}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {!selected.length && <li className="text-sm text-muted-foreground">Henüz ürün seçilmedi.</li>}
            </ol>
            <div className="flex max-w-xl gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void search();
                  }
                }}
                placeholder="Ürün ara"
                aria-label="Ürün ara"
                className={input}
              />
              <Button type="button" variant="outline" onClick={() => void search()} disabled={searching} className="gap-2">
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Ara
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="max-w-xl divide-y divide-border rounded-xl border border-border">
                {results.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    {p.name}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={selected.includes(p.id) || selected.length >= 24}
                      onClick={() => {
                        setNames({ ...names, [p.id]: p.name });
                        setValue("productIds", [...selected, p.id]);
                      }}
                    >
                      {selected.includes(p.id) ? "Eklendi" : "Ekle"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </AreaCard>
  );
}
