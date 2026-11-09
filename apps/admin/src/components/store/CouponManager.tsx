"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Save, TicketPercent } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { FormField } from "@/components/forms/FormField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCouponAction, deleteCouponAction, updateCouponAction } from "@/app/actions/store";
import {
  COUPON_TYPE_LABEL,
  COUPON_TYPES,
  couponDefaults,
  couponSchema,
  type CouponFormValues,
} from "@/lib/validations/store.schema";

export type CouponRow = CouponFormValues & {
  id: string;
  usedCount: number;
  /** Ekranda gösterilecek özet (ör. "%10 · en fazla 200 ₺") */
  summary: string;
  period: string;
  status: "active" | "inactive" | "expired" | "scheduled" | "used-up";
};

const STATUS = {
  active: ["Geçerli", "bg-emerald-500/10 text-emerald-700"],
  inactive: ["Pasif", "bg-neutral-500/10 text-neutral-600"],
  expired: ["Süresi doldu", "bg-neutral-500/10 text-neutral-600"],
  scheduled: ["Başlamadı", "bg-amber-500/10 text-amber-700"],
  "used-up": ["Hakkı doldu", "bg-neutral-500/10 text-neutral-600"],
} as const;

const selectClass = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm disabled:opacity-60";

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const open = (target: CouponRow | "new") => {
    setFormKey((k) => k + 1);
    setEditing(target);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => open("new")} className="min-h-11 gap-2 px-5 font-semibold">
          <Plus className="size-4" />
          Kupon Ekle
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <TicketPercent className="size-6" />
          Henüz kupon yok.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {coupons.map((c) => {
            const [label, cls] = STATUS[c.status];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                <span className="rounded-lg bg-(--brand-primary)/10 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-(--brand-primary)">{c.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {c.summary}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.period} · {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""} kullanım
                  </p>
                </div>
                <Button type="button" variant="outline" aria-label={`${c.code} kuponunu düzenle`} onClick={() => open(c)} className="size-9 p-0">
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDeleteDialog
                  title={`"${c.code}" silinsin mi?`}
                  description={c.usedCount > 0 ? "Bu kupon siparişlerde kullanıldı; silinemez, pasif yapabilirsiniz." : "Bu işlem geri alınamaz."}
                  onConfirm={() => deleteCouponAction(c.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing === "new" ? "Yeni Kupon" : "Kuponu Düzenle"}</DialogTitle>
            <DialogDescription>İndirim sepet tutarı üzerinden, sunucuda hesaplanır.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <CouponForm
              key={formKey}
              target={editing}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CouponForm({ target, onCancel, onDone }: { target: CouponRow | "new"; onCancel: () => void; onDone: () => void }) {
  const isNew = target === "new";
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CouponFormValues>({ resolver: zodResolver(couponSchema), defaultValues: isNew ? couponDefaults : target });
  const type = useWatch({ control, name: "type" });

  async function submit(values: CouponFormValues) {
    setError(null);
    const result = isNew ? await createCouponAction(values) : await updateCouponAction(target.id, values);
    if (!result.success) return setError(result.error);
    onDone();
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="@container space-y-5">
      <div className="grid gap-5 @xl:grid-cols-2">
        <FormField name="code" label="Kupon Kodu" placeholder="YAZ20" description={isNew ? "Büyük harfe çevrilir." : "Kod değiştirilemez."} disabled={!isNew} register={register} error={errors.code} required />
        <label className="flex flex-col gap-2 text-sm font-medium">
          İndirim Türü
          <select {...register("type")} disabled={!isNew} className={selectClass}>
            {COUPON_TYPES.map((t) => (
              <option key={t} value={t}>
                {COUPON_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        {type !== "FREE_SHIPPING" && (
          <FormField
            name="value"
            label={type === "PERCENT" ? "İndirim Yüzdesi (%)" : "İndirim Tutarı (₺)"}
            placeholder={type === "PERCENT" ? "10" : "50"}
            register={register}
            error={errors.value}
            required
          />
        )}
        {type === "PERCENT" && (
          <FormField name="maxDiscount" label="En Fazla İndirim (₺)" placeholder="200" description="Boş = sınırsız." register={register} error={errors.maxDiscount} />
        )}
        <FormField name="minSubtotal" label="En Düşük Sepet Tutarı (₺)" placeholder="300" description="Boş = sınır yok." register={register} error={errors.minSubtotal} />
        <FormField name="startsAt" label="Başlangıç" type="datetime-local" register={register} error={errors.startsAt} />
        <FormField name="endsAt" label="Bitiş" type="datetime-local" register={register} error={errors.endsAt} />
        <FormField name="usageLimit" label="Toplam Kullanım Sınırı" placeholder="100" description="Boş = sınırsız." register={register} error={errors.usageLimit} />
        <FormField name="perUserLimit" label="Kişi Başı Kullanım Sınırı" placeholder="1" description="Boş = sınırsız." register={register} error={errors.perUserLimit} />
      </div>
      <FormSwitch name="isActive" label="Aktif" description="Kapalıysa kupon kabul edilmez." control={control} />

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          İptal
        </Button>
        <Button type="submit" disabled={isSubmitting || (!isNew && !isDirty)} className="min-h-11 gap-2 px-5">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Kuponu Kaydet
        </Button>
      </div>
    </form>
  );
}
