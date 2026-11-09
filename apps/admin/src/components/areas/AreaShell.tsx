import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";

/**
 * Yönetim ekranlarının ortak çerçevesi (enfesGurme düzeni):
 * "Yönetim Paneli" etiketi, büyük başlık, açıklama; altında başlıklı paneller.
 */
export function AreaShell({
  icon: Icon,
  eyebrow = "Yönetim Paneli",
  title,
  description,
  shared = false,
  back = { href: "/dashboard", label: "Dashboard" },
  actions,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  description: string;
  /** Tüm sayfalarda görünen ortak alan mı */
  shared?: boolean;
  back?: { href: string; label: string } | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1800px] space-y-5 pb-12">
      {back && (
        <nav aria-label="Sayfa yolu" className="text-sm text-muted-foreground">
          <Link href={back.href} className="inline-flex items-center gap-1.5 hover:text-(--brand-accent)">
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        </nav>
      )}

      <AreaHeader icon={Icon} eyebrow={eyebrow} title={title} description={description} shared={shared} actions={actions} />

      {children}
    </main>
  );
}

export function AreaHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  shared,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  shared?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:px-7 sm:py-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-(--brand-accent)/8 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-(--brand-primary) text-white shadow-sm sm:flex">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--brand-accent)">{eyebrow}</p>
            <h1 className="brand-heading mt-1.5 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight text-(--brand-primary) sm:text-4xl">
              {title}
              {shared && (
                <span className="inline-flex items-center gap-1 rounded-full bg-(--brand-accent)/10 px-2.5 py-1 text-xs font-semibold tracking-normal text-(--brand-accent)">
                  <Link2 className="size-3" />
                  Tüm sayfalarda ortak
                </span>
              )}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions}
      </div>
    </header>
  );
}

/** Başlıklı panel (ör. "Genel Header Ayarları") */
export function AreaCard({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <div>
          <h2 className="brand-heading text-xl font-bold tracking-tight text-(--brand-primary)">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="@container p-5 sm:px-7 sm:py-6">{children}</div>
    </section>
  );
}
