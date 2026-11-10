"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Yedek kodlar yalnızca bir kez gösterilir: kopyala / indir */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = `Yönetim paneli yedek kodları (her biri bir kez kullanılır)\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Bu kodları güvenli bir yere (şifre yöneticisi, çıktı) kaydedin. Telefonunuzu kaybederseniz giriş için bunlar gerekir. <strong>Bir daha gösterilmeyecek.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface-muted p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => undefined);
            setCopied(true);
          }}
        >
          <Copy className="size-4" />
          {copied ? "Kopyalandı" : "Kopyala"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "yedek-kodlar.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" />
          İndir (.txt)
        </Button>
      </div>
    </div>
  );
}
