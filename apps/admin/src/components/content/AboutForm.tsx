"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

import { saveAboutAction } from "@/app/actions/content";
import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";

export type AboutValues = {
  isPublished: boolean;
  backgroundColor: string;
  cardImage: string;
  textureImage: string;
  sketchImage1: string;
  sketchImage2: string;
  sketchImage3: string;
  sketchImage4: string;
  visionTitle: string;
  visionText: string;
  visionImage: string;
  visionMiniImage: string;
  missionHeading: string;
  missionTitle: string;
  missionText: string;
  missionImage: string;
  storyHeading: string;
  storyTitle: string;
  storyText: string;
  storyImage: string;
  miniImage1: string;
  miniImage2: string;
  miniImage3: string;
  valuesHeading: string;
  valuesTitle: string;
  valuesText: string;
  valuesImage: string;
  metaTitle: string;
  metaDescription: string;
};

type ImageName = Extract<keyof AboutValues, `${string}Image${string}`>;

const input =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";
const TEXT_HINT = "En fazla 600 karakter. Satır başı bırakabilirsin.";

/**
 * Hakkımızda sayfası (eski enfesGurme düzeni): Vizyon, Misyon, Hikaye ve Değerler bölümleri.
 * Bilgisayarda 2x2 serbest yerleşim, tablet/telefonda kartlar. Metni boş bölüm sayfada gösterilmez.
 */
export function AboutForm({
  initial,
  mediaBaseUrl,
  storefrontUrl,
}: {
  initial: AboutValues;
  mediaBaseUrl: string;
  storefrontUrl: string | null;
}) {
  const { register, control, handleSubmit, setValue, formState } =
    useForm<AboutValues>({ defaultValues: initial });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const color = useWatch({ control, name: "backgroundColor" });

  const site = (path: string) =>
    storefrontUrl ? `${storefrontUrl}${path}` : null;
  const image = (
    name: ImageName,
    label: string,
    description?: string,
    fallback?: string | null,
  ) => (
    <ImageUploadField
      name={name}
      label={label}
      control={control}
      mediaBaseUrl={mediaBaseUrl}
      description={description}
      fallbackSrc={fallback ?? null}
    />
  );

  async function submit(v: AboutValues) {
    setError(null);
    setDone(false);
    const r = await saveAboutAction(v);
    if (!r.success) return setError(r.error);
    setDone(true);
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid gap-5">
      <AreaCard
        title="Genel"
        hint="Metni girilmemiş bölümler sayfada görünmez. Hiç metin yoksa sayfa yayınlanmaz."
      >
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormSwitch
            name="isPublished"
            label="Sayfa yayında"
            control={control}
          />
          {storefrontUrl && (
            <a
              href={`${storefrontUrl}/hakkimizda`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 self-center text-sm font-semibold text-(--brand-accent) hover:underline"
            >
              Sayfayı mağazada aç <ExternalLink className="size-4" />
            </a>
          )}
          <label className="flex flex-col gap-2 text-sm font-medium">
            Arka plan rengi
            <span className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Arka plan rengi seçici"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#efe3cc"}
                onChange={(e) =>
                  setValue("backgroundColor", e.target.value, {
                    shouldDirty: true,
                  })
                }
                className="h-11 w-14 rounded-lg border border-border bg-surface p-1"
              />
              <input
                {...register("backgroundColor")}
                maxLength={7}
                className={`${input} font-mono uppercase`}
              />
            </span>
          </label>
        </div>
        <div className="mt-5 grid gap-5 @xl:grid-cols-2">
          {image(
            "cardImage",
            "Kart zemini",
            "Görsellerin ve telefon kartlarının arkasındaki dokulu zemin.",
            site("/images/kart-doku.webp"),
          )}
          {image(
            "textureImage",
            "Kart dokusu",
            "Kart zemininin üstüne çok hafif (%8) bindirilen doku.",
            site("/images/bakir-doku.webp"),
          )}
        </div>
      </AreaCard>

      <AreaCard
        title="Arka Plan Çizimleri"
        hint="Sayfanın arkasında silik görünen çizimler (şeffaf PNG/WEBP önerilir). Boş bırakılan gösterilmez."
      >
        <div className="grid gap-5 @xl:grid-cols-2">
          {image("sketchImage1", "Çizim 1 (sol üst)")}
          {image("sketchImage2", "Çizim 2 (sol alt)")}
          {image("sketchImage3", "Çizim 3 (sağ alt)")}
          {image("sketchImage4", "Çizim 4 (sağ üst)")}
        </div>
      </AreaCard>

      <AreaCard title="Vizyon" hint="Sol üstteki büyük görselli giriş bölümü.">
        <div className="grid gap-5">
          <FormField
            name="visionTitle"
            label="Başlık"
            register={register}
            required
          />
          <FormTextarea
            name="visionText"
            label="Açıklama"
            rows={4}
            register={register}
            description={TEXT_HINT}
          />
          <div className="grid gap-5 @xl:grid-cols-2">
            {image(
              "visionImage",
              "Ana görsel",
              "Solda kenarları zemine karışan büyük görsel.",
            )}
            {image(
              "visionMiniImage",
              "Alt görsel",
              "Açıklamanın altındaki küçük görsel (boşsa 1. küçük görsel).",
            )}
          </div>
        </div>
      </AreaCard>

      <AreaCard title="Misyon" hint="Sağ üstteki bölüm.">
        <SectionFields
          prefix="mission"
          register={register}
          image={image("missionImage", "Görsel")}
        />
      </AreaCard>

      <AreaCard
        title="Hikaye"
        hint="Sol alttaki bölüm; solunda üç küçük görsel durur."
      >
        <div className="grid gap-5">
          <SectionFields
            prefix="story"
            register={register}
            image={image("storyImage", "Görsel")}
          />
          <div className="grid gap-5 @xl:grid-cols-3">
            {image("miniImage1", "Küçük görsel 1")}
            {image("miniImage2", "Küçük görsel 2")}
            {image("miniImage3", "Küçük görsel 3")}
          </div>
        </div>
      </AreaCard>

      <AreaCard
        title="Değerler"
        hint="Sağ alttaki bölüm. Görsel kırpılmadan sığdırılır (ürün ya da obje görseli için uygun)."
      >
        <SectionFields
          prefix="values"
          register={register}
          image={image("valuesImage", "Görsel")}
        />
      </AreaCard>

      <AreaCard
        title="Arama Motorları (SEO)"
        hint="Boş bırakılırsa sayfa başlığı ve vizyon metni kullanılır."
      >
        <div className="grid gap-5 @xl:grid-cols-2">
          <FormField
            name="metaTitle"
            label="Sayfa başlığı (en fazla 70)"
            register={register}
          />
          <FormField
            name="metaDescription"
            label="Açıklama (en fazla 160)"
            register={register}
          />
        </div>
      </AreaCard>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="size-4" /> Kaydedildi. Mağaza en geç 1 dakika
          içinde güncellenir.
        </p>
      )}
      <div>
        <Button
          type="submit"
          disabled={formState.isSubmitting}
          className="min-h-11 gap-2 rounded-full px-7"
        >
          {formState.isSubmitting && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Kaydet
        </Button>
      </div>
    </form>
  );
}

function SectionFields({
  prefix,
  register,
  image,
}: {
  prefix: "mission" | "story" | "values";
  register: ReturnType<typeof useForm<AboutValues>>["register"];
  image: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        <FormField
          name={`${prefix}Heading`}
          label="Bölüm başlığı"
          register={register}
          required
        />
        <FormTextarea
          name={`${prefix}Title`}
          label="Başlık"
          rows={2}
          register={register}
          description="Kartın üstündeki büyük yazı. Satır başı bırakabilirsin."
        />
        <FormTextarea
          name={`${prefix}Text`}
          label="Açıklama"
          rows={4}
          register={register}
          description={TEXT_HINT}
        />
      </div>
      {image}
    </div>
  );
}
