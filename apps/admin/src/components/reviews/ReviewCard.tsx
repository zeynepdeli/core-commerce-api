"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Star } from "lucide-react";

import { deleteReviewAction, moderateReviewAction, replyReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/send";

type Review = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rating: number;
  title: string | null;
  comment: string;
  verifiedPurchase: boolean;
  rejectReason: string | null;
  reply: string | null;
  createdAt: string;
  product: { name: string };
  author: { name: string; email: string; deleted: boolean };
};

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
const area = "w-full rounded-xl border border-border bg-surface p-3 text-sm";

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`5 üzerinden ${value} puan`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewCard({ r }: { r: Review }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject" | "reply">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.success) return setError(res.error);
      setMode("idle");
      router.refresh();
    });

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Stars value={r.rating} />
        <span className="font-semibold">{r.product.name}</span>
        {r.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <BadgeCheck className="size-3.5" /> Doğrulanmış alıcı
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{fmt.format(new Date(r.createdAt))}</span>
      </header>
      {r.title && <h3 className="mt-3 font-semibold">{r.title}</h3>}
      {/* Düz metin: React kaçışlar, HTML yorumlanmaz */}
      <p className="mt-1 whitespace-pre-line text-sm leading-6">{r.comment}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {r.author.name} · {r.author.email}
        {r.author.deleted && " · hesap kapalı"}
      </p>
      {r.status === "REJECTED" && r.rejectReason && <p className="mt-2 text-xs text-red-700">Ret gerekçesi: {r.rejectReason}</p>}
      {r.reply && mode !== "reply" && <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm">Mağaza yanıtı: {r.reply}</p>}

      {mode !== "idle" && (
        <div className="mt-4 grid gap-3">
          <textarea
            autoFocus
            rows={3}
            maxLength={mode === "reject" ? 500 : 1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "reject" ? "Gerekçe (yazara e-postayla gider, isteğe bağlı)" : "Herkese açık yanıt (boş bırakırsanız yanıt kaldırılır)"}
            className={area}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              variant={mode === "reject" ? "destructive" : "default"}
              onClick={() => run(() => (mode === "reject" ? moderateReviewAction(r.id, "REJECTED", text) : replyReviewAction(r.id, text)))}
              className="gap-2"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {mode === "reject" ? "Reddet" : "Yanıtı kaydet"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {mode === "idle" && (
        <footer className="mt-4 flex flex-wrap gap-2">
          {r.status !== "APPROVED" && (
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, "APPROVED"))}>
              Yayınla
            </Button>
          )}
          {r.status !== "REJECTED" && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setText(""); setMode("reject"); }}>
              Reddet
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setText(r.reply ?? ""); setMode("reply"); }}>
            {r.reply ? "Yanıtı düzenle" : "Yanıtla"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => confirm("Yorum kalıcı olarak silinsin mi?") && run(() => deleteReviewAction(r.id))}
            className="text-destructive"
          >
            Sil
          </Button>
        </footer>
      )}
    </article>
  );
}
