import { KeyRound } from "lucide-react";

/** Giriş dışı herkese açık sayfaların (şifremi unuttum, yenile) kartı */
export function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-(--brand-primary) text-white shadow-lg">
            <KeyRound size={24} strokeWidth={1.7} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl sm:p-9">{children}</div>
      </div>
    </main>
  );
}
