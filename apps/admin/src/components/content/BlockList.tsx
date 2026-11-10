"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, Pencil, Trash2 } from "lucide-react";

import { deleteBlockAction, reorderBlocksAction, setBlockActiveAction } from "@/app/actions/content";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/admin/send";

type Row = { id: string; key: string; type: string; label: string; summary: string; isActive: boolean; scheduled: string | null };

/** Sıralanabilir liste (yukarı/aşağı), aç/kapat, sil */
export function BlockList({ rows, editBase }: { rows: Row[]; editBase: string }) {
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
    run(() => reorderBlocksAction(ids));
  };

  if (!rows.length) return <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Henüz bölüm yok. Aşağıdan ekleyin.</p>;

  return (
    <div className="grid gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ol className="divide-y divide-border rounded-2xl border border-border" aria-busy={pending}>
        {rows.map((r, i) => (
          <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.isActive ? "" : "opacity-60"}`}>
            <span className="flex flex-col">
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label={`${r.label} yukarı taşı`}>
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={pending || i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`${r.label} aşağı taşı`}>
                <ArrowDown className="size-4" />
              </Button>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.label} <span className="font-mono text-xs text-muted-foreground">#{r.key}</span>
              </p>
              <p className="truncate text-sm text-muted-foreground">{r.summary}</p>
              {r.scheduled && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-800">
                  <CalendarClock className="size-3.5" /> {r.scheduled}
                </p>
              )}
            </div>
            <Switch checked={r.isActive} disabled={pending} aria-label={`${r.label} yayında`} onCheckedChange={(v) => run(() => setBlockActiveAction(r.id, v))} />
            <Link href={`${editBase}/${r.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-muted">
              <Pencil className="size-3.5" /> Düzenle
            </Link>
            <Button type="button" size="icon" variant="ghost" disabled={pending} aria-label={`${r.label} sil`} onClick={() => confirm("Bölüm silinsin mi?") && run(() => deleteBlockAction(r.id))} className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
