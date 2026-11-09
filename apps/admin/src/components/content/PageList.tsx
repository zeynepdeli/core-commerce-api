"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

import { deletePageAction, reorderPagesAction } from "@/app/actions/content";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/send";

type Row = { id: string; slug: string; title: string; isPublished: boolean; showInFooter: boolean };

export function PageList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.success) setError(r.error);
      router.refresh();
    });
  const move = (i: number, d: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    run(() => reorderPagesAction(ids));
  };
  if (!rows.length) return <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Henüz sayfa yok.</p>;
  return (
    <div className="grid gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ol className="divide-y divide-border rounded-2xl border border-border" aria-busy={pending}>
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex flex-col">
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label={`${r.title} yukarı`}>
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`${r.title} aşağı`}>
                <ArrowDown className="size-4" />
              </Button>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.title} {!r.isPublished && <span className="ml-1 rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">Taslak</span>}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                /sayfa/{r.slug}
                {r.showInFooter && r.isPublished && " · alt bilgide"}
              </p>
            </div>
            <Link href={`/content/pages/${r.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted">
              <Pencil className="size-3.5" /> Düzenle
            </Link>
            <Button type="button" size="icon" variant="ghost" disabled={pending} aria-label={`${r.title} sil`} onClick={() => confirm(`"${r.title}" silinsin mi?`) && run(() => deletePageAction(r.id))} className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
