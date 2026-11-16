"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  TicketPercent,
  Trash2,
} from "lucide-react";

import {
  deleteCampaignAction,
  reorderCampaignsAction,
  saveCampaignAction,
} from "@/app/actions/content";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/admin/send";
import type { Campaign } from "@/lib/content";

type Draft = {
  title: string;
  description: string;
  badge: string;
  imageUrl: string;
  couponCode: string;
  linkUrl: string;
  linkLabel: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const input =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";
const label = "flex flex-col gap-2 text-sm font-medium";
const hint = "text-xs font-normal text-muted-foreground";

/** ISO → <input type="datetime-local"> değeri (tarayıcının saat diliminde) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const toDraft = (c?: Campaign): Draft => ({
  title: c?.title ?? "",
  description: c?.description ?? "",
  badge: c?.badge ?? "",
  imageUrl: c?.imageUrl ?? "",
  couponCode: c?.couponCode ?? "",
  linkUrl: c?.linkUrl ?? "",
  linkLabel: c?.linkLabel ?? "",
  startsAt: toLocalInput(c?.startsAt ?? null),
  endsAt: toLocalInput(c?.endsAt ?? null),
  isActive: c?.isActive ?? true,
});

const toPayload = (d: Draft) => ({
  title: d.title,
  description: d.description || null,
  badge: d.badge || null,
  imageUrl: d.imageUrl || null,
  couponCode: d.couponCode || null,
  linkUrl: d.linkUrl || null,
  linkLabel: d.linkLabel || null,
  startsAt: toIso(d.startsAt),
  endsAt: toIso(d.endsAt),
  isActive: d.isActive,
});

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Mağazada şu an görünüyor mu? (Tarih penceresi + yayında anahtarı) */
function status(c: Campaign, now: number): { text: string; tone: string } {
  if (!c.isActive)
    return { text: "Pasif", tone: "bg-surface-muted text-muted-foreground" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now)
    return {
      text: "Planlandı",
      tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    };
  if (c.endsAt && new Date(c.endsAt).getTime() <= now)
    return {
      text: "Süresi doldu",
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    };
  return {
    text: "Yayında",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
}

function Editor({
  initial,
  mediaBaseUrl,
  onSave,
  onCancel,
  pending,
}: {
  initial: Draft;
  mediaBaseUrl: string;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const { register, handleSubmit, control } = useForm<Draft>({
    defaultValues: initial,
  });
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSave)}>
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="grid content-start gap-3">
          <label className={label}>
            Başlık
            <input
              {...register("title")}
              maxLength={80}
              required
              className={input}
              placeholder="Baklava Haftası"
            />
          </label>
          <label className={label}>
            Açıklama
            <textarea
              {...register("description")}
              maxLength={400}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm"
              placeholder="Tüm baklavalarda sepette %10 indirim."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Rozet{" "}
              <span className={hint}>
                Görselin köşesinde (ör. %10, Yeni, 2 Al 1 Öde)
              </span>
              <input {...register("badge")} maxLength={24} className={input} />
            </label>
            <label className={label}>
              Kupon kodu{" "}
              <span className={hint}>
                Kuponlar ekranındaki kod; geçerli değilse mağazada gösterilmez
              </span>
              <input
                {...register("couponCode")}
                maxLength={32}
                className={`${input} uppercase`}
                placeholder="BAKLAVA10"
              />
            </label>
            <label className={label}>
              Bağlantı{" "}
              <span className={hint}>
                Site içi yol (/urunlerimiz) ya da https adresi
              </span>
              <input
                {...register("linkUrl")}
                maxLength={500}
                className={input}
                placeholder="/urunlerimiz?kategori=baklava"
              />
            </label>
            <label className={label}>
              Bağlantı yazısı
              <input
                {...register("linkLabel")}
                maxLength={30}
                className={input}
                placeholder="Alışverişe Başla"
              />
            </label>
            <label className={label}>
              Başlangıç <span className={hint}>Boşsa hemen</span>
              <input
                type="datetime-local"
                {...register("startsAt")}
                className={input}
              />
            </label>
            <label className={label}>
              Bitiş{" "}
              <span className={hint}>
                Boşsa süresiz; mağazada “son X gün” olarak görünür
              </span>
              <input
                type="datetime-local"
                {...register("endsAt")}
                className={input}
              />
            </label>
          </div>
        </div>
        <ImageUploadField
          name="imageUrl"
          label="Görsel"
          control={control}
          mediaBaseUrl={mediaBaseUrl}
          description="Yatay görsel önerilir (ör. 1200×800)."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-11 gap-2">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Kaydet
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function CampaignManager({
  items,
  mediaBaseUrl,
}: {
  items: Campaign[];
  mediaBaseUrl: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.success) return setError(r.error);
      after?.();
      router.refresh();
    });
  const move = (i: number, d: -1 | 1) => {
    const ids = items.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    run(() => reorderCampaignsAction(ids));
  };
  const preview = (src: string) =>
    src.startsWith("/media/") ? `${mediaBaseUrl}${src}` : src;

  return (
    <div className="grid gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {items.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Henüz kampanya yok.
        </p>
      )}
      <ol className="grid gap-2">
        {items.map((c, i) => {
          const st = status(c, now);
          return (
            <li
              key={c.id}
              className={`rounded-2xl border border-border p-4 ${c.isActive ? "" : "opacity-60"}`}
            >
              {editing === c.id ? (
                <Editor
                  initial={toDraft(c)}
                  mediaBaseUrl={mediaBaseUrl}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={(d) =>
                    run(
                      () => saveCampaignAction(c.id, toPayload(d)),
                      () => setEditing(null),
                    )
                  }
                />
              ) : (
                <div className="flex gap-3">
                  <span className="flex flex-col">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={pending || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Yukarı"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={pending || i === items.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Aşağı"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </span>
                  <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted sm:grid sm:place-items-center">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- yönetim önizlemesi
                      <img
                        src={preview(c.imageUrl)}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageOff
                        className="size-5 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {c.title}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.tone}`}
                      >
                        {st.text}
                      </span>
                      {c.badge && (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold">
                          {c.badge}
                        </span>
                      )}
                    </p>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.couponCode && (
                        <span className="inline-flex items-center gap-1">
                          <TicketPercent className="size-3.5" aria-hidden />{" "}
                          {c.couponCode}
                        </span>
                      )}
                      {(c.startsAt || c.endsAt) && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {c.startsAt
                            ? dateFmt.format(new Date(c.startsAt))
                            : "Hemen"}{" "}
                          →{" "}
                          {c.endsAt
                            ? dateFmt.format(new Date(c.endsAt))
                            : "süresiz"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-start gap-1">
                    <Switch
                      checked={c.isActive}
                      disabled={pending}
                      aria-label="Yayında"
                      onCheckedChange={(v) =>
                        run(() =>
                          saveCampaignAction(c.id, {
                            ...toPayload(toDraft(c)),
                            isActive: v,
                          }),
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Düzenle"
                      onClick={() => setEditing(c.id)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label="Sil"
                      onClick={() =>
                        confirm("Kampanya silinsin mi?") &&
                        run(() => deleteCampaignAction(c.id))
                      }
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {adding ? (
        <div className="rounded-2xl border border-border p-4">
          <Editor
            initial={toDraft()}
            mediaBaseUrl={mediaBaseUrl}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSave={(d) =>
              run(
                () => saveCampaignAction(null, toPayload(d)),
                () => setAdding(false),
              )
            }
          />
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding(true)}
            className="gap-2"
          >
            <Plus className="size-4" /> Kampanya ekle
          </Button>
        </div>
      )}
    </div>
  );
}
