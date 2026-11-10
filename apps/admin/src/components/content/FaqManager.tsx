"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteFaqAction, reorderFaqAction, saveFaqAction } from "@/app/actions/content";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/admin/send";

type Faq = { id: string; question: string; answer: string; category: string | null; isActive: boolean };
type Draft = { question: string; answer: string; category: string; isActive: boolean };
const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

function Editor({ initial, categories, onSave, onCancel, pending }: { initial: Draft; categories: string[]; onSave: (d: Draft) => void; onCancel?: () => void; pending: boolean }) {
  const [d, setD] = useState(initial);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-medium">
        Soru
        <input value={d.question} onChange={(e) => setD({ ...d, question: e.target.value })} maxLength={300} required className={input} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Cevap
        <textarea value={d.answer} onChange={(e) => setD({ ...d, answer: e.target.value })} maxLength={5000} rows={4} required className="w-full rounded-xl border border-border bg-surface p-3 text-sm" />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm font-medium">
          Kategori (isteğe bağlı)
          <input value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} maxLength={60} list="faq-categories" placeholder="Kargo, İade, Ödeme…" className={input} />
          <datalist id="faq-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <Button type="submit" disabled={pending} className="min-h-11 gap-2">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Kaydet
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Vazgeç
          </Button>
        )}
      </div>
    </form>
  );
}

export function FaqManager({ items }: { items: Faq[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))];

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
    run(() => reorderFaqAction(ids));
  };
  const payload = (d: Draft) => ({ question: d.question, answer: d.answer, category: d.category || null, isActive: d.isActive });

  return (
    <div className="grid gap-4">
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {items.length === 0 && !adding && <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Henüz soru yok.</p>}
      <ol className="grid gap-2">
        {items.map((f, i) => (
          <li key={f.id} className={`rounded-2xl border border-border p-4 ${f.isActive ? "" : "opacity-60"}`}>
            {editing === f.id ? (
              <Editor
                initial={{ question: f.question, answer: f.answer, category: f.category ?? "", isActive: f.isActive }}
                categories={categories}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={(d) => run(() => saveFaqAction(f.id, payload(d)), () => setEditing(null))}
              />
            ) : (
              <div className="flex gap-3">
                <span className="flex flex-col">
                  <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Yukarı">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === items.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı">
                    <ArrowDown className="size-4" />
                  </Button>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {f.question} {f.category && <span className="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold">{f.category}</span>}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{f.answer}</p>
                </div>
                <div className="flex items-start gap-1">
                  <Switch checked={f.isActive} disabled={pending} aria-label="Yayında" onCheckedChange={(v) => run(() => saveFaqAction(f.id, payload({ question: f.question, answer: f.answer, category: f.category ?? "", isActive: v })))} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Düzenle" onClick={() => setEditing(f.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" disabled={pending} aria-label="Sil" onClick={() => confirm("Soru silinsin mi?") && run(() => deleteFaqAction(f.id))} className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {adding ? (
        <div className="rounded-2xl border border-border p-4">
          <Editor initial={{ question: "", answer: "", category: "", isActive: true }} categories={categories} pending={pending} onCancel={() => setAdding(false)} onSave={(d) => run(() => saveFaqAction(null, payload(d)), () => setAdding(false))} />
        </div>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={() => setAdding(true)} className="gap-2">
            <Plus className="size-4" /> Soru ekle
          </Button>
        </div>
      )}
    </div>
  );
}
