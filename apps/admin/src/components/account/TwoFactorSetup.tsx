"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

import { enableTwoFactorAction, startTwoFactorSetupAction } from "@/app/actions/two-factor";
import { Button } from "@/components/ui/button";

import { RecoveryCodes } from "./RecoveryCodes";

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm";

/**
 * Kurulum: şifre → QR kodu okut → kodu gir → yedek kodları kaydet.
 * Açıldıktan sonra sunucu sayfayı yeniler; bileşen aynı yerde kaldığı için
 * yedek kodlar ekrandan kaybolmaz. "enabled" iken (ve kod ekranında değilken) "whenEnabled" gösterilir.
 */
export function TwoFactorSetup({ next, enabled = false, whenEnabled }: { next: string; enabled?: boolean; whenEnabled?: React.ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run<T extends { success: boolean; error?: string }>(fn: () => Promise<T>, then: (r: T) => void) {
    setPending(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.success) return setError(r.error ?? "İşlem yapılamadı.");
      then(r);
    } finally {
      setPending(false);
    }
  }

  const errorBox = error && (
    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </p>
  );

  if (enabled && step !== "codes") return <>{whenEnabled}</>;

  if (step === "password") {
    return (
      <form
        className="grid max-w-md gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => startTwoFactorSetupAction(password),
            (r) => {
              if ("secret" in r) setSetup({ secret: r.secret, qrSvg: r.qrSvg });
              setPassword("");
              setStep("scan");
            },
          );
        }}
      >
        <p className="text-sm text-muted-foreground">Telefonunuza Google Authenticator, Microsoft Authenticator veya benzeri bir uygulama kurun. Başlamak için şifrenizi girin.</p>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Şifre
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </label>
        {errorBox}
        <div>
          <Button type="submit" disabled={pending} className="min-h-11 gap-2 px-6">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Kuruluma Başla
          </Button>
        </div>
      </form>
    );
  }

  if (step === "scan" && setup) {
    return (
      <form
        className="grid gap-6 md:grid-cols-[220px_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => enableTwoFactorAction(code),
            (r) => {
              if ("recoveryCodes" in r) setCodes(r.recoveryCodes);
              setStep("codes");
            },
          );
        }}
      >
        {/* QR SVG'si sunucuda qrcode kütüphanesiyle üretildi (kullanıcı girdisi içermez) */}
        <div className="rounded-2xl border border-border bg-white p-3" aria-label="Kimlik doğrulayıcı QR kodu" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
        <div className="grid content-start gap-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Uygulamada &quot;Hesap ekle&quot; → &quot;QR kodu tara&quot;.</li>
            <li>Uygulamada görünen 6 haneli kodu aşağıya yazın.</li>
          </ol>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">QR okutamıyorum — anahtarı elle gir</summary>
            <p className="mt-2 break-all rounded-xl bg-surface-muted p-3 font-mono text-sm tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
          </details>
          <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">
            Doğrulama kodu
            <input
              autoFocus
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${input} text-center font-mono text-lg tracking-[0.3em]`}
            />
          </label>
          {errorBox}
          <div>
            <Button type="submit" disabled={pending || code.length !== 6} className="min-h-11 gap-2 px-6">
              {pending && <Loader2 className="size-4 animate-spin" />}
              Doğrula ve Aç
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="grid max-w-xl gap-5">
      <p className="flex items-center gap-2 font-medium text-emerald-700">
        <ShieldCheck className="size-5" /> İki adımlı doğrulama açıldı. Diğer cihazlardaki oturumlar kapatıldı.
      </p>
      <RecoveryCodes codes={codes} />
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4" />
        Yedek kodları kaydettim
      </label>
      <div>
        <Button
          type="button"
          disabled={!saved}
          onClick={() => {
            router.replace(next);
            router.refresh();
          }}
          className="min-h-11 px-6"
        >
          Devam Et
        </Button>
      </div>
    </div>
  );
}
