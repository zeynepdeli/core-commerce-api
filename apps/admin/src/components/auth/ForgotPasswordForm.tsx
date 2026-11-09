"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";

import { requestPasswordResetAction } from "@/app/actions/password-reset";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await requestPasswordResetAction(email);
    setLoading(false);
    if (result.success) setMessage(result.message ?? "");
    else setError(result.error);
  }

  if (message) {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-800">
          {message}
        </p>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-(--brand-accent) hover:underline">
          <ArrowLeft className="size-4" />
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">E-posta adresi</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-(--brand-accent) focus:ring-2 focus:ring-(--brand-accent)/20"
          placeholder="ornek@site.com"
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={loading || !email.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--brand-primary) text-sm font-semibold text-white transition hover:bg-(--brand-primary)/90 disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Sıfırlama bağlantısı gönder
      </button>
      <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-(--brand-accent)">
        <ArrowLeft className="size-4" />
        Girişe dön
      </Link>
    </form>
  );
}
