"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { disableTwoFactorAction, regenerateRecoveryCodesAction } from "@/app/actions/two-factor";
import { Button } from "@/components/ui/button";

import { RecoveryCodes } from "./RecoveryCodes";

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

/** 2FA açıkken: yedek kodları yenile, kapat */
export function TwoFactorManage({ remaining, required }: { remaining: number; required: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "regen" | "disable">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = (m: typeof mode) => {
    setMode(m);
    setCode("");
    setPassword("");
    setError(null);
  };

  async function submit() {
    setPending(true);
    setError(null);
    try {
      if (mode === "regen") {
        const r = await regenerateRecoveryCodesAction(code);
        if (!r.success) return setError(r.error);
        setCodes(r.recoveryCodes);
        reset("idle");
      } else {
        const r = await disableTwoFactorAction(password, code);
        if (!r.success) return setError(r.error);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (codes) {
    return (
      <div className="grid max-w-xl gap-4">
        <RecoveryCodes codes={codes} />
        <div>
          <Button type="button" variant="outline" onClick={() => { setCodes(null); router.refresh(); }}>
            Kaydettim
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-4">
      <p className={`text-sm ${remaining <= 3 ? "font-medium text-amber-800" : "text-muted-foreground"}`}>
        Kullanılmamış yedek kod: {remaining}
        {remaining <= 3 && " — yenilerini oluşturmanız önerilir."}
      </p>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => reset("regen")}>
            Yeni yedek kodlar oluştur
          </Button>
          <Button type="button" variant="outline" onClick={() => reset("disable")} className="text-destructive">
            Kapat
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "disable" && (
            <>
              {required && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Bu mağazada iki adımlı doğrulama zorunlu. Kapatırsanız panele girmeden önce yeniden kurmanız istenecek (ör. yeni telefon için).</p>}
              <label className="flex flex-col gap-2 text-sm font-medium">
                Şifre
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              </label>
            </>
          )}
          <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">
            {mode === "regen" ? "Uygulamadaki kod" : "Uygulamadaki kod veya yedek kod"}
            <input required autoComplete="one-time-code" maxLength={11} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${input} font-mono tracking-widest`} />
          </label>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="submit" disabled={pending} variant={mode === "disable" ? "destructive" : "default"} className="gap-2">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {mode === "regen" ? "Oluştur" : "İki Adımlı Doğrulamayı Kapat"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => reset("idle")}>
              Vazgeç
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
