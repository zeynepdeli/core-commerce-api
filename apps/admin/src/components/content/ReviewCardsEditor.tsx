"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type FieldValues } from "react-hook-form";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mediaSrc } from "@/lib/media-src";

/** Müşteri yorumu kartı (API: ReviewCardDto). Formda boş alanlar "" olarak tutulur. */
export type ReviewCard = {
  name: string;
  rating: number;
  comment: string;
  productImage: string;
  userImage: string;
};

/** API sınırıyla aynı (MAX_REVIEW_CARDS) */
const MAX_CARDS = 12;
const EMPTY: ReviewCard = { name: "", rating: 5, comment: "", productImage: "", userImage: "" };

const input =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--brand-accent)/40 aria-invalid:border-destructive";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 gap-0.5" aria-label={`${value} yıldız`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className="size-3.5 text-amber-500" fill={n <= value ? "currentColor" : "transparent"} />
      ))}
    </span>
  );
}

/**
 * Ana sayfa müşteri yorumları: eski enfesGurme admin'indeki gibi her yorum tek satırda,
 * ekleme ve düzenleme pencerede. Değişiklikler sayfadaki "Kaydet" ile gönderilir.
 */
export function ReviewCardsEditor<T extends FieldValues>({ control, mediaBaseUrl }: { control: Control<T>; mediaBaseUrl: string }) {
  const c = control as unknown as Control<{ cards: ReviewCard[] }>;
  const { fields, append, update, remove, move } = useFieldArray({ control: c, name: "cards" });
  const cards = useWatch({ control: c, name: "cards" }) ?? [];
  const [editing, setEditing] = useState<"new" | number | null>(null);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Yalnızca gerçek müşteri yorumlarını, müşterinin izniyle ekle. {cards.length}/{MAX_CARDS} yorum.
        </p>
        <Button type="button" onClick={() => setEditing("new")} disabled={fields.length >= MAX_CARDS} className="gap-2">
          <Plus className="size-4" /> Yorum ekle
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Henüz yorum yok. Yorum eklenene kadar bu bölüm mağazada görünmez.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {fields.map((f, i) => {
            const card = cards[i] ?? EMPTY;
            return (
              <li key={f.id} className="flex items-center gap-3 bg-card px-3 py-2">
                <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                  {card.productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(card.productImage, mediaBaseUrl)} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{card.name || "(isimsiz)"}</span>
                    <Stars value={Number(card.rating) || 0} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">&quot;{card.comment}&quot;</span>
                </span>
                <span className="flex shrink-0">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`${i + 1}. yorumu yukarı taşı`}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={`${i + 1}. yorumu aşağı taşı`}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(i)} aria-label={`${card.name || `${i + 1}. yorum`} düzenle`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label={`${card.name || `${i + 1}. yorum`} kaldır`} className="text-destructive">
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
            <DialogTitle className="text-xl">{editing === "new" ? "Yeni Yorum" : "Yorumu Düzenle"}</DialogTitle>
            <DialogDescription>Kaydettikten sonra sayfanın altındaki &quot;Kaydet&quot; ile mağazaya gönder.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <ReviewForm
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

function ReviewForm({ initial, mediaBaseUrl, onSave, onCancel }: { initial: ReviewCard; mediaBaseUrl: string; onSave: (card: ReviewCard) => void; onCancel: () => void }) {
  const { control, register, handleSubmit, formState, setError, clearErrors, getValues } = useForm<ReviewCard>({ defaultValues: initial });
  const e = formState.errors;

  // Ürün fotoğrafı ImageUploadField (Controller) ile yönetiliyor; zorunluluğu burada denetlenir
  const productImage = useWatch({ control, name: "productImage" });
  useEffect(() => {
    if (productImage?.trim()) clearErrors("productImage");
  }, [productImage, clearErrors]);
  const imageMissing = () => {
    if (getValues("productImage").trim()) return false;
    setError("productImage", { message: "Kartın arka planı için bir ürün fotoğrafı seçin." });
    return true;
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label="Müşterinin adı" error={e.name?.message} hint="Ör. Ayşe K. (soyadın baş harfi yeterli)">
          <input
            {...register("name", { validate: (v) => (v.trim() ? (v.trim().length <= 60 ? true : "En fazla 60 karakter.") : "Ad yazın.") })}
            maxLength={60}
            placeholder="Ayşe K."
            aria-invalid={!!e.name}
            className={input}
            autoFocus
          />
        </Field>
        <Field label="Puan">
          <select {...register("rating", { valueAsNumber: true })} className={input}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Yorum" error={e.comment?.message}>
        <textarea
          {...register("comment", { validate: (v) => (v.trim() ? (v.trim().length <= 300 ? true : "En fazla 300 karakter.") : "Yorumu yazın.") })}
          maxLength={300}
          rows={3}
          placeholder="Peynirler çok taze geldi, paketleme özenliydi."
          aria-invalid={!!e.comment}
          className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--brand-accent)/40 aria-invalid:border-destructive"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <ImageUploadField name="productImage" label="Ürün fotoğrafı" control={control} mediaBaseUrl={mediaBaseUrl} required description="Kartın arka planında görünür." />
        <ImageUploadField name="userImage" label="Müşteri fotoğrafı (isteğe bağlı)" control={control} mediaBaseUrl={mediaBaseUrl} description="Yoksa adın baş harfleri gösterilir." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(
            (v) => {
              if (imageMissing()) return;
              onSave({ name: v.name.trim(), rating: Number(v.rating) || 5, comment: v.comment.trim(), productImage: v.productImage.trim(), userImage: v.userImage.trim() });
            },
            () => void imageMissing(),
          )}
        >
          Yorumu kaydet
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
