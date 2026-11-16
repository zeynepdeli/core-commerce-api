"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2, X } from "lucide-react";

import { saveBlockAction, searchProductsAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { CustomCardsEditor } from "@/components/content/CustomCardsEditor";
import { ReviewCardsEditor } from "@/components/content/ReviewCardsEditor";
import { DEFAULT_VIDEO_BOX, VideoBoxEditor } from "@/components/content/VideoBoxEditor";
import { VideoUploadField } from "@/components/forms/VideoUploadField";
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
  /** Mağaza adresi: varsayılan arka plan / video önizlemesi için (boşsa önizlemede gösterilmez) */
  storefrontUrl: string;
};

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";
const area = "w-full rounded-xl border border-border bg-surface p-3 text-sm";
const ICON_LABEL: Record<string, string> = { truck: "Kamyon (kargo)", shield: "Kalkan (güven)", gift: "Hediye", leaf: "Yaprak (doğal)", phone: "Telefon", refresh: "Yenile (iade)", star: "Yıldız", clock: "Saat", award: "Ödül", heart: "Kalp", "credit-card": "Kart", "map-pin": "Konum", package: "Paket" };

function Text({ label, name, register, max, area: isArea, placeholder, hint }: { label: string; name: string; register: UseFormRegister<Data>; max: number; area?: boolean; placeholder?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {isArea ? <textarea {...register(name)} maxLength={max} rows={3} placeholder={placeholder} className={area} /> : <input {...register(name)} maxLength={max} placeholder={placeholder} className={input} />}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}
/** Slayt süresi seçenekleri (saniye). API sınırıyla aynı: 3–15 (apps/api/src/content/content.dto.ts → HERO_INTERVAL) */
const HERO_INTERVALS = [3, 4, 5, 6, 7, 8, 10, 12, 15] as const;
const HERO_INTERVAL_DEFAULT = 5;
/** Ürün listesinde kartların kaynağı: elle girilen kartlar ya da ürünler */
const CARD_MODES = [
  { custom: true, title: "Kendi kartlarım", text: "Fotoğraf, isim, fiyat ve bağlantıyı ben girerim (eski sitedeki gibi)." },
  { custom: false, title: "Ürünlerimden otomatik", text: "Öne çıkan, çok satan, en yeni ya da seçtiğim ürünler; fiyat ve stok hep güncel." },
] as const;
const LINK_HINT = "/ ile başlayan site içi adres (ör. /kategori/peynir) veya https:// adresi.";

/** Boş metinleri kaldır, tarihleri ISO'ya çevir (API boş alanı "yok" sayar) */
function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== null && x !== undefined).map(([k, x]) => [k, clean(x)]));
  return typeof v === "string" ? v.trim() : v;
}

export function BlockEditor({ id, type, initial, initialKey, categories, productNames, icons, mediaBaseUrl, storefrontUrl }: Props) {
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Data>({
    defaultValues: {
      key: initialKey,
      ...initial,
      visibleFrom: toLocal(initial.visibleFrom),
      visibleUntil: toLocal(initial.visibleUntil),
      // Süresi kaydedilmemiş eski slider'lar mağazadaki gibi 5 sn görünsün (seçim kutusu ilk seçeneğe düşmesin)
      ...(type === "HERO" && { intervalSeconds: String(initial.intervalSeconds ?? HERO_INTERVAL_DEFAULT) }),
      // Görünümü kaydedilmemiş eski listeler: mağazanın bugünkü davranışı (öne çıkanlar → slider içi)
      ...(type === "PRODUCT_LIST" && { display: initial.display ?? (initial.source === "featured" ? "hero" : "band") }),
      // Video yeri kaydedilmemişse mağazadaki varsayılan kapıya göre yer
      ...(type === "CATEGORY_GRID" && { videoBox: initial.videoBox ?? DEFAULT_VIDEO_BOX }),
      ...(type === "REVIEWS" && { approvedLimit: String(initial.approvedLimit ?? 6) }),
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Kategoriler: video yeri önizlemesi seçili arka plan ve videoyu izler (useWatch: React Compiler ile uyumlu)
  const desktopBackground = useWatch({ control, name: "desktopBackground" }) as string | undefined;
  const videoUrl = useWatch({ control, name: "videoUrl" }) as string | undefined;

  async function submit(v: Data) {
    setError(null);
    setSaved(false);
    const { key, ...data } = v;
    // Tek kategori varsa onay kutusu dizi yerine değer/boolean döner: her zaman diziye çevir
    if (type === "CATEGORY_GRID") data.categoryIds = (Array.isArray(data.categoryIds) ? data.categoryIds : typeof data.categoryIds === "string" ? [data.categoryIds] : []).filter((x: unknown) => typeof x === "string" && x);
    // Seçim kutusu metin döndürür; API tam sayı bekler
    if (type === "REVIEWS") data.approvedLimit = Number(data.approvedLimit) || 6;
    // Elle kartlar: ürün sayısı ve ürün seçimi gönderilmez (API de saklamaz)
    if (type === "PRODUCT_LIST" && data.source === "custom") {
      delete data.limit;
      delete data.productIds;
    }
    // Seçim kutusu metin döndürür; API tam sayı bekler
    if (type === "HERO") data.intervalSeconds = Number(data.intervalSeconds) || HERO_INTERVAL_DEFAULT;
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
      {type === "PRODUCT_LIST" && <ProductListFields control={control} register={register} watch={watch} setValue={setValue} categories={categories} productNames={productNames} mediaBaseUrl={mediaBaseUrl} />}
      {type === "CATEGORY_GRID" && (
        <>
        <AreaCard title="Yazılar" hint="Boş bırakılan alanda örnekteki yazı kullanılır.">
          <div className="grid gap-5 @xl:grid-cols-2">
            <Text label="Başlığın üstündeki küçük yazı" name="eyebrow" register={register} max={60} placeholder="Keşfetmeye Devam Edin" />
            <Text label="Başlık" name="title" register={register} max={80} placeholder="Kategoriler" />
            <div className="@xl:col-span-2">
              <Text label="Açıklama (masaüstünde görünür)" name="description" register={register} max={300} area placeholder="Anadolu'nun en özel lezzetlerini keşfedin. Her kategori, geleneksel üretimin izlerini taşır." />
            </div>
            <Text label="Kart yazısı" name="buttonLabel" register={register} max={20} placeholder="İncele" />
          </div>
        </AreaCard>
        <AreaCard title="Video ve arka plan" hint="Soldaki kemerli kapının içinde video oynar. Boş bırakılırsa mağazanın varsayılan videosu ve kemerli duvar görseli kullanılır.">
          <div className="grid gap-5">
            <VideoUploadField
              name="videoUrl"
              label="Kapıdaki video"
              control={control}
              mediaBaseUrl={mediaBaseUrl}
              fallbackSrc={storefrontUrl ? `${storefrontUrl}/videos/kategori-kapi.mp4` : null}
              description="MP4 ya da WebM, en fazla 25 MB (10–15 saniyelik, 1280px genişliğinde bir video yeterli). Sessiz ve döngüde oynar. Cloudinary video bağlantısı da yapıştırılabilir."
            />
            <div className="grid gap-5 @xl:grid-cols-2">
              <ImageUploadField
                name="desktopBackground"
                label="Masaüstü arka plan"
                control={control}
                mediaBaseUrl={mediaBaseUrl}
                fallbackSrc={storefrontUrl ? `${storefrontUrl}/images/kategori-kemer.webp` : null}
                description="Solunda kemerli kapı olan duvar görseli. Değiştirirsen videonun yerini aşağıdan kapıya göre ayarla."
              />
              <ImageUploadField
                name="mobileBackground"
                label="Telefon arka planı"
                control={control}
                mediaBaseUrl={mediaBaseUrl}
                fallbackSrc={storefrontUrl ? `${storefrontUrl}/images/duvar-zemin.webp` : null}
                description="Boşsa masaüstü görseli kullanılır."
              />
            </div>
          </div>
        </AreaCard>
        <AreaCard title="Videonun yeri" hint="Video, masaüstü arka plandaki kapının boşluğuna yerleşir. Kaydırıcılarla kapıya oturt; önizleme mağazadaki oranla çizilir.">
          <VideoBoxEditor
            control={control}
            setValue={setValue}
            mediaBaseUrl={mediaBaseUrl}
            background={desktopBackground || (storefrontUrl ? `${storefrontUrl}/images/kategori-kemer.webp` : null)}
            video={videoUrl || (storefrontUrl ? `${storefrontUrl}/videos/kategori-kapi.mp4` : null)}
          />
        </AreaCard>
        <AreaCard title="Kategoriler" hint="Hiçbiri seçilmezse admin'deki sırayla ilk kategoriler gösterilir. Ana sayfada en fazla 4 kategori görünür (eski sitedeki gibi); görselleri Kategoriler sayfasından gelir.">
          <div className="grid gap-5">
            <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <legend className="mb-2 text-sm font-medium">Gösterilecek kategoriler (sırasıyla ilk 4)</legend>
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={c.id} {...register("categoryIds")} className="size-4" /> {c.name}
                </label>
              ))}
            </fieldset>
          </div>
        </AreaCard>
        </>
      )}
      {type === "REVIEWS" && (
        <>
          <AreaCard title="Müşteri Yorumları">
            <div className="grid gap-5">
              <div className="grid gap-5 @xl:grid-cols-2">
                <Text label="Başlık" name="title" register={register} max={80} placeholder="Müşterilerimizin Kalbinden" />
                <Text label="Açıklama" name="description" register={register} max={300} placeholder="Anadolu'nun eşsiz lezzetlerini deneyimleyen müşterilerimizin gerçek yorumları." />
              </div>
              <ReviewCardsEditor control={control} mediaBaseUrl={mediaBaseUrl} />
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-2xl border border-border p-4">
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" {...register("includeApproved")} className="size-4" />
                  Sitedeki onaylı müşteri yorumlarını da göster
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  En fazla
                  <select {...register("approvedLimit")} className={`${input} w-32`}>
                    {[3, 6, 9, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} yorum
                      </option>
                    ))}
                  </select>
                </label>
                <p className="w-full text-xs text-muted-foreground">
                  Ürün sayfalarında müşterilerin yazdığı ve Yorumlar&apos;da onayladığın 4–5 yıldızlı yorumlar, en yeniden başlayarak senin eklediklerinden sonra gösterilir. Müşterinin adı kısaltılır (ör. &quot;Ayşe Y.&quot;), kartın arka planında yorumlanan ürünün fotoğrafı olur.
                </p>
              </div>
            </div>
          </AreaCard>
          <AreaCard title="Görseller" hint="Boş bırakılırsa eski sitedeki taş duvar ve haki çerçeve kullanılır.">
            <div className="grid gap-5 @xl:grid-cols-2">
              <ImageUploadField name="backgroundImage" label="Bölüm arka planı" control={control} mediaBaseUrl={mediaBaseUrl} />
              <ImageUploadField name="frameImage" label="Kart çerçevesi" control={control} mediaBaseUrl={mediaBaseUrl} description="Yorum kutusunun altındaki çerçeve; arka planı şeffaf PNG/WEBP." />
            </div>
          </AreaCard>
        </>
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
      {type === "FEATURES" && <FeatureFields control={control} register={register} icons={icons} mediaBaseUrl={mediaBaseUrl} storefrontUrl={storefrontUrl} />}

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
        <div className="max-w-xl">
          <Text
            label="Başlığın üstündeki küçük yazı"
            name="eyebrow"
            register={register}
            max={60}
            placeholder="Anadolu'nun En Özel Lezzetleri"
            hint="Tüm slaytlarda başlığın üstünde görünür. Boş bırakılırsa örnekteki yazı kullanılır."
          />
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" {...register("autoplay")} className="size-4" /> Otomatik geçiş
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Slayt süresi
            <select {...register("intervalSeconds")} className={`${input} w-40`}>
              {HERO_INTERVALS.map((s) => (
                <option key={s} value={s}>
                  {s} saniye
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Her slaytın ekranda kalma süresi (otomatik geçiş açıkken). Ziyaretçi fareyle slaytın üstüne gelince ya da duraklat düğmesine basınca geçiş durur.
        </p>
      </div>
    </AreaCard>
  );
}

/** Avantaj kartı sayısı: API ile aynı (apps/api/src/content/content.dto.ts → MAX_FEATURE_ITEMS) */
const MAX_FEATURE_ITEMS = 8;

/** Avantajlar ("Antep'in Bereketi", eski enfesGurme): solda başlık + açıklama, sağda numaralı simge kartları */
function FeatureFields({
  control,
  register,
  icons,
  mediaBaseUrl,
  storefrontUrl,
}: {
  control: Control<Data>;
  register: UseFormRegister<Data>;
  icons: string[];
  mediaBaseUrl: string;
  storefrontUrl: string;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
  const site = (path: string) => (storefrontUrl ? `${storefrontUrl}${path}` : null);
  return (
    <>
      <AreaCard title="Bölüm" hint="Solda büyük başlık ve açıklama. Arka plan ve kart dokusu boşsa varsayılan görsel kullanılır.">
        <div className="grid gap-5">
          <Text label="Başlık" name="title" register={register} max={80} placeholder="ANTEP'İN BEREKETİ" />
          <Text label="Açıklama" name="description" register={register} max={300} area />
          <div className="grid gap-5 @xl:grid-cols-2">
            <ImageUploadField name="backgroundImage" label="Arka plan" control={control} mediaBaseUrl={mediaBaseUrl} fallbackSrc={site("/images/duvar-zemin.webp")} />
            <ImageUploadField name="cardTexture" label="Kart dokusu" control={control} mediaBaseUrl={mediaBaseUrl} fallbackSrc={site("/images/kart-doku.webp")} />
          </div>
        </div>
      </AreaCard>
      <AreaCard title="Kartlar" hint={`Numara (01, 02…) sıraya göre otomatik verilir. Bilgisayarda 4'lü sıra; en fazla ${MAX_FEATURE_ITEMS}.`}>
        <div className="grid gap-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid items-end gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[auto_180px_1fr_auto]">
              <span className="flex min-h-11 items-center font-mono text-sm font-semibold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
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
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. kartı yukarı taşı`} onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. kartı aşağı taşı`} onClick={() => move(i, i + 1)} disabled={i === fields.length - 1}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. kartı kaldır`} onClick={() => remove(i)} disabled={fields.length === 1} className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {fields.length < MAX_FEATURE_ITEMS && (
            <div>
              <Button type="button" variant="outline" onClick={() => append({ icon: icons[0], title: "" })} className="gap-2">
                <Plus className="size-4" /> Kart ekle
              </Button>
            </div>
          )}
        </div>
      </AreaCard>
    </>
  );
}

function ProductListFields({
  control,
  register,
  watch,
  setValue,
  categories,
  productNames,
  mediaBaseUrl,
}: {
  control: Control<Data>;
  register: UseFormRegister<Data>;
  watch: (n: string) => any;
  setValue: (n: string, v: any) => void;
  categories: { id: string; name: string }[];
  productNames: Record<string, string>;
  mediaBaseUrl: string;
}) {
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

  const custom = source === "custom";
  // Kendi kartlarımdan ürünlere dönünce son seçilen ürün kaynağı geri gelsin
  const [productSource, setProductSource] = useState<string>(custom ? "featured" : source);

  return (
    <AreaCard title="Ürün Listesi">
      <div className="grid gap-5">
        {/* En önemli seçim en üstte ve görünür: kartları kim dolduruyor? */}
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold">Kartlar nereden gelsin?</legend>
          <div className="grid gap-3 @xl:grid-cols-2">
            {CARD_MODES.map((o) => (
              <label
                key={o.title}
                className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${custom === o.custom ? "border-(--brand-accent) bg-(--brand-accent)/5" : "border-border hover:border-(--brand-accent)/40"}`}
              >
                <input type="radio" name="card-mode" checked={custom === o.custom} onChange={() => setValue("source", o.custom ? "custom" : productSource)} className="mt-1 size-4 shrink-0" />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{o.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {custom && <CustomCardsEditor control={control} mediaBaseUrl={mediaBaseUrl} />}

        <div className="grid gap-5 @xl:grid-cols-2">
          <Text label="Başlık" name="title" register={register} max={80} placeholder="Çok satanlar" />
          <Text label="Alt başlık" name="subtitle" register={register} max={200} />
          {!custom && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Hangi ürünler
              <select {...register("source", { onChange: (e) => setProductSource(e.target.value) })} className={input}>
              <option value="featured">Öne çıkan ürünler</option>
              <option value="new">En yeniler</option>
              <option value="bestsellers">Çok satanlar (son 30 gün)</option>
              <option value="rating">En beğenilenler (puan)</option>
              <option value="category">Bir kategoriden</option>
              <option value="manual">Elle seçilen ürünler</option>
              </select>
            </label>
          )}
          {source !== "custom" && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Kaç ürün
              <input type="number" min={1} max={24} {...register("limit")} className={input} />
            </label>
          )}
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
          <label className="flex flex-col gap-2 text-sm font-medium">
            Görünüm
            <select {...register("display")} className={input}>
              <option value="band">Ürün bandı (tabaklı kartlar, ör. En Çok Satanlar)</option>
              <option value="hero">Slider&apos;ın içinde kartlar (ör. Günün Öne Çıkanları)</option>
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              &quot;Slider&apos;ın içinde&quot; seçilen liste, Ana Sayfa Düzeni&apos;nde slider&apos;ın hemen altındaysa slider&apos;ın içinde en fazla 4 kart olarak görünür; değilse ürün bandı olarak.
            </span>
          </label>
          <Text label="Kart düğmesi yazısı" name="cardButtonLabel" register={register} max={20} placeholder="Sepete Ekle / Keşfet" hint="Her ürün kartının üstündeki hap yazısı. Stokta olmayan üründe &quot;Tükendi&quot; yazar." />
          <Text label="Alttaki buton yazısı" name="buttonLabel" register={register} max={30} placeholder="Tümünü gör" />
          <Text label="Alttaki buton bağlantısı" name="buttonLink" register={register} max={500} hint={`Boşsa buton görünmez. ${LINK_HINT}`} />
        </div>
        {source === "featured" && (
          <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">
            Ürünler sayfasında <strong>&quot;Öne çıkan ürün&quot;</strong> işaretli ürünler gösterilir. Hiçbiri işaretli değilse en yeni ürünler gösterilir. Fotoğraf, isim ve fiyatı kendin girmek için yukarıdan &quot;Kendi kartlarım&quot;ı seç.
          </p>
        )}
        {source === "bestsellers" && (
          <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">
            Son 30 günde en çok satan ürünler. Yeterli satış yoksa liste en yeni ürünlerle tamamlanır.
          </p>
        )}
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

