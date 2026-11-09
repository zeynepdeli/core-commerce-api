"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BRAND } from "@/brand/brand";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowRight, LoaderCircle } from "lucide-react";
import { loginAdmin } from "@/app/actions";

export function LoginForm({ resetDone }: { resetDone: boolean }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await loginAdmin(email.trim(), password);

      if (!result.success) {
        setError(result.error ?? "Giriş yapılamadı.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-9 text-center">
          {BRAND.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={BRAND.logo} alt="" className="mx-auto mb-5 h-14 w-auto max-w-48 object-contain" />
          ) : (
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <LockKeyhole size={25} strokeWidth={1.7} />
            </div>
          )}

          <h1 className="brand-heading text-3xl font-semibold tracking-tight text-foreground">
            {BRAND.name}
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {BRAND.tagline}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-primary/5 sm:p-9">
          <div className="mb-7">
            <h2 className="text-xl font-semibold text-foreground">
              Yönetici Girişi
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Devam etmek için hesabınıza giriş yapın.
            </p>
          </div>

          {resetDone && (
            <p role="status" className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                E-posta adresi
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Şifre
                </label>
                <Link href="/forgot-password" className="text-xs font-medium text-(--brand-accent) hover:underline">
                  Şifremi unuttum
                </Link>
              </div>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Şifrenizi girin"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  Giriş Yap
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-7 text-center text-xs text-muted-foreground">
          {BRAND.name} · Güvenli Yönetim
        </p>
      </div>
    </main>
  );
}
