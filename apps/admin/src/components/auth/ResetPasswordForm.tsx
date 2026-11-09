"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

import { resetPasswordAction } from "@/app/actions/password-reset";

const input = "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-(--brand-accent) focus:ring-2 focus:ring-(--brand-accent)/20";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Token adresin # kısmında gelir (…/reset-password#token=…): sunucu
 * loglarına ve Referer başlığına düşmez. Okunduktan sonra adresten silinir.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  // Geliştirmede effect iki kez çalışır; adres silindikten sonra ilk okunan değer korunur
  const readToken = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (readToken.current === undefined) {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
      readToken.current = value && TOKEN.test(value) ? value : null;
      window.history.replaceState(null, "", window.location.pathname);
    }
    setToken(readToken.current);
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || !token) return;
    setLoading(true);
    setError(null);
    const result = await resetPasswordAction({ token, newPassword, confirmPassword });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.replace("/login?sifre=yenilendi");
  }

  if (token === undefined) return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  if (token === null) {
    return (
      <div className="space-y-4 text-sm">
        <p role="alert" className="text-destructive">Bağlantı geçersiz veya eksik.</p>
        <Link href="/forgot-password" className="font-medium text-(--brand-accent) hover:underline">Yeni bağlantı iste</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="newPassword" className="mb-2 block text-sm font-medium">Yeni şifre</label>
        <input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} />
        <p className="mt-1.5 text-xs text-muted-foreground">En az 12 karakter; büyük harf, küçük harf ve rakam.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">Yeni şifre (tekrar)</label>
        <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={input} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--brand-primary) text-sm font-semibold text-white transition hover:bg-(--brand-primary)/90 disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Şifreyi yenile
      </button>
    </form>
  );
}
