"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type FieldValues } from "react-hook-form";
import { ArrowDown, ArrowUp, ImageIcon, Link2, Pencil, Plus, Trash2 } from "lucide-react";

import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mediaSrc } from "@/lib/media-src";

/** Elle girilen kart (API: CustomCardDto). Formda boş alanlar "" olarak tutulur. */
export type CustomCard = {
  name: string;
  imageUrl: string;
  price: string;
  compareAtPrice: string;
  link: string;
  soldOut: boolean;
};

/** API sınırıyla aynı (MAX_CUSTOM_CARDS) */
const MAX_CARDS = 12;
const EMPTY: CustomCard = { name: "", imageUrl: "", price: "", compareAtPrice: "", link: "", soldOut: false };

// API'deki kurallarla aynı; burada yalnızca anında uyarı için (asıl denetim API'de)
const PRICE = /^\d{1,7}([.,]\d{1,2})?$/;
const isSafeLink = (v: string) => (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || v.startsWith("https://");

const input =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--brand-accent)/40 aria-invalid:border-destructive";

/** "149,9" → "₺149,90" (yalnızca listede gösterim için) */
function showPrice(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }) : v;
}

/**
 * Elle girilen kartlar: eski enfesGurme admin'indeki gibi her kart tek satırda listelenir;
 * ekleme ve düzenleme bir pencerede (modal) yapılır. Değişiklikler sayfadaki "Kaydet" ile kaydedilir.
 */
export function CustomCardsEditor<T extends FieldValues>({ control, mediaBaseUrl }: { control: Control<T>; mediaBaseUrl: string }) {
  // Kartlar üst formun bir alanı: tip parametresi formun kendisi, alan adı sabit
  const c = control as unknown as Control<{ cards: CustomCard[] }>;
  const { fields, append, update, remove, move } = useFieldArray({ control: c, name: "cards" });
  const cards = useWatch({ control: c, name: "cards" }) ?? [];
  /** null: pencere kapalı; "new": yeni kart; sayı: düzenlenen kartın sırası */
  const [editing, setEditing] = useState<"new" | number | null>(null);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Kartlar ürünlerden bağımsızdır; fiyat değişince buradan da güncelle. {cards.length}/{MAX_CARDS} kart.
        </p>
        <Button type="button" onClick={() => setEditing("new")} disabled={fields.length >= MAX_CARDS} className="gap-2">
          <Plus className="size-4" /> Kart ekle
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Henüz kart yok. &quot;Kart ekle&quot; ile fotoğraf, isim ve fiyatla ilk kartını ekle.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {fields.map((f, i) => {
            const card = cards[i] ?? EMPTY;
            const discounted = card.price && card.compareAtPrice && Number(card.compareAtPrice.replace(",", ".")) > Number(card.price.replace(",", "."));
            return (
              <li key={f.id} className="flex items-center gap-3 bg-card px-3 py-2">
                <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(card.imageUrl, mediaBaseUrl)} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{card.name || "(isimsiz)"}</span>
                  {card.link && (
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Link2 className="size-3 shrink-0" /> {card.link}
                    </span>
                  )}
                </span>
                {card.soldOut && <span className="hidden shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive sm:inline">Tükendi</span>}
                <span className="hidden w-36 shrink-0 text-right text-sm tabular-nums sm:block">
                  {discounted && <s className="mr-1.5 text-xs text-muted-foreground">{showPrice(card.compareAtPrice)}</s>}
                  {card.price ? <span className="font-semibold">{showPrice(card.price)}</span> : <span className="text-xs text-muted-foreground">fiyatsız</span>}
                </span>
                <span className="flex shrink-0">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${i + 1}. kartı yukarı taşı`}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={`${i + 1}. kartı aşağı taşı`}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(i)} aria-label={`${card.name || `${i + 1}. kart`} düzenle`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`${card.name || `${i + 1}. kart`} kaldır`} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing === "new" ? "Yeni Kart" : "Kartı Düzenle"}</DialogTitle>
            <DialogDescription>Kaydettikten sonra sayfanın altındaki &quot;Kaydet&quot; ile mağazaya gönder.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <CardForm
              // Her açılışta taze form
              key={String(editing)}
              initial={editing === "new" ? EMPTY : { ...EMPTY, ...cards[editing] }}
              mediaBaseUrl={mediaBaseUrl}
              onCancel={() => setEditing(null)}
              onSave={(card) => {
                if (editing === "new") append(card);
                else update(editing, card);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Penceredeki kart formu: kendi form durumu var; "Kartı kaydet" ile listeye işlenir */
function CardForm({ initial, mediaBaseUrl, onSave, onCancel }: { initial: CustomCard; mediaBaseUrl: string; onSave: (card: CustomCard) => void; onCancel: () => void }) {
  const { control, register, handleSubmit, formState, setError, clearErrors, getValues } = useForm<CustomCard>({ defaultValues: initial });
  // Fotoğraf seçilince "fotoğraf seçin" uyarısı hemen kalksın
  const imageUrl = useWatch({ control, name: "imageUrl" });
  useEffect(() => {
    if (imageUrl?.trim()) clearErrors("imageUrl");
  }, [imageUrl, clearErrors]);
  // Fotoğraf ImageUploadField (Controller) ile yönetiliyor; zorunluluğu burada denetlenir.
  // Diğer alanlar hatalı olsa da çağrılır: tüm uyarılar birlikte görünsün.
  const imageMissing = () => {
    if (getValues("imageUrl").trim()) return false;
    setError("imageUrl", { message: "Fotoğraf seçin ya da yükleyin." });
    return true;
  };
  const e = formState.errors;

  return (
    // Üst formun içinde ama ayrı bir <form> değil (iç içe form olmaz): kaydet düğmesi handleSubmit'i çağırır
    <div className="grid gap-5">
      <ImageUploadField name="imageUrl" label="Fotoğraf" control={control} mediaBaseUrl={mediaBaseUrl} required description="Arka planı şeffaf PNG/WEBP, eski sitedeki gibi en iyi görünür." />

      <Field label="İsim" error={e.name?.message}>
        <input
          {...register("name", { validate: (v) => (v.trim() ? (v.trim().length <= 80 ? true : "En fazla 80 karakter.") : "İsim yazın.") })}
          maxLength={80}
          placeholder="Antep Fıstıklı Helva"
          aria-invalid={!!e.name}
          className={input}
          autoFocus
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fiyat (₺, isteğe bağlı)" error={e.price?.message}>
          <input
            {...register("price", { validate: (v) => !v.trim() || PRICE.test(v.trim()) || "Sayı olmalı (ör. 149,90)." })}
            inputMode="decimal"
            maxLength={12}
            placeholder="149,90"
            aria-invalid={!!e.price}
            className={input}
          />
        </Field>
        <Field label="Eski fiyat (indirim için)" error={e.compareAtPrice?.message}>
          <input
            {...register("compareAtPrice", { validate: (v) => !v.trim() || PRICE.test(v.trim()) || "Sayı olmalı (ör. 189,90)." })}
            inputMode="decimal"
            maxLength={12}
            placeholder="189,90"
            aria-invalid={!!e.compareAtPrice}
            className={input}
          />
        </Field>
      </div>
      <Field label="Bağlantı (isteğe bağlı)" error={e.link?.message} hint="Boşsa kart tıklanmaz. Ör. /urun/antep-fistikli-helva ya da https:// adresi.">
        <input
          {...register("link", { validate: (v) => !v.trim() || isSafeLink(v.trim()) || "/ ile başlayan site içi adres ya da https:// adresi olmalı." })}
          maxLength={500}
          placeholder="/urun/antep-fistikli-helva"
          aria-invalid={!!e.link}
          className={input}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("soldOut")} className="size-4" /> Tükendi olarak göster
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(
            (v) => {
              if (imageMissing()) return;
              onSave({ ...v, imageUrl: v.imageUrl.trim(), name: v.name.trim(), price: v.price.trim(), compareAtPrice: v.compareAtPrice.trim(), link: v.link.trim() });
            },
            () => void imageMissing(),
          )}
        >
          Kartı kaydet
        </Button>
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs font-normal text-destructive">{error}</span> : hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}
