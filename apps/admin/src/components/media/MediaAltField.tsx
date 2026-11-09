"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateMediaAltAction } from "@/app/actions/media";

/** Görsel açıklaması: Enter'a basınca veya alandan çıkınca kaydedilir */
export function MediaAltField({
  id,
  initial,
}: {
  id: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  function save() {
    const next = value.trim();
    if (next === saved) return;
    start(async () => {
      const result = await updateMediaAltAction(id, next);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(next);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Açıklama (alt metni)"
          aria-label="Görsel açıklaması"
          className="h-8 w-full rounded-lg border border-border bg-surface px-2 pr-7 text-xs"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : justSaved ? (
            <Check className="size-3.5 text-emerald-600" />
          ) : null}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
