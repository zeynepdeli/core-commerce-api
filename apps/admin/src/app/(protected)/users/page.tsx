import Link from "next/link";
import { Search, Users } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { UsersList } from "@/components/users/UsersManager";
import { getUsers } from "@/lib/admin-users";
import { getAdminUser } from "@/lib/auth";

const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

/** Kilit süresi dolmamış mı? (sunucuda, istek anında hesaplanır) */
function isLocked(until: string | null) {
  return until !== null && Date.parse(until) > Date.now();
}

const ROLES = [
  { value: "", label: "Tüm roller" },
  { value: "CUSTOMER", label: "Müşteriler" },
  { value: "ADMIN", label: "Yöneticiler" },
  { value: "SUPER_ADMIN", label: "Süper yöneticiler" },
] as const;
const STATUSES = [
  { value: "", label: "Tüm durumlar" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Askıda" },
  { value: "locked", label: "Kilitli" },
  { value: "deleted", label: "Kapatılmış" },
] as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rol?: string; durum?: string; sayfa?: string }>;
}) {
  const sp = await searchParams;
  // Adres çubuğundaki değerler doğrulanır
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = ROLES.some((r) => r.value === sp.rol) ? (sp.rol ?? "") : "";
  const status = STATUSES.some((s) => s.value === sp.durum) ? (sp.durum ?? "") : "";
  const page = Math.min(Math.max(Number.parseInt(sp.sayfa ?? "1", 10) || 1, 1), 10000);

  const [result, me] = await Promise.all([getUsers({ q, role, status, page }), getAdminUser()]);

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (role) s.set("rol", role);
    if (status) s.set("durum", status);
    if (p > 1) s.set("sayfa", String(p));
    const qs = s.toString();
    return `/users${qs ? `?${qs}` : ""}`;
  };

  return (
    <AreaShell
      icon={Users}
      title="Kullanıcı Yönetimi"
      description="Müşteriler ve yöneticiler. Askıya alınan hesabın açık oturumları hemen kapanır. Yönetici yetkisini yalnızca süper yönetici verebilir."
    >
      <AreaCard title={`Kullanıcılar (${result.total})`}>
        <form method="get" className="mb-5 grid gap-3 @2xl:grid-cols-[1fr_200px_180px_auto]">
          <label className="relative">
            <span className="sr-only">Kullanıcı ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} maxLength={100} placeholder="Ad veya e-posta" className="min-h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm" />
          </label>
          <select name="rol" defaultValue={role} aria-label="Rol" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select name="durum" defaultValue={status} aria-label="Durum" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-11 rounded-xl bg-(--brand-primary) px-5 text-sm font-semibold text-white">
            Filtrele
          </button>
        </form>

        <UsersList
          canChangeRoles={me?.role === "SUPER_ADMIN"}
          users={result.items.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            verified: u.emailVerifiedAt !== null,
            google: u.signupMethod === "GOOGLE",
            isActive: u.isActive,
            deleted: u.deletedAt !== null,
            locked: isLocked(u.lockedUntil),
            createdAt: fmt.format(new Date(u.createdAt)),
            isMe: u.id === me?.id,
            twoFactor: u.twoFactorEnabledAt !== null,
          }))}
        />

        {result.pages > 1 && (
          <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between text-sm">
            {result.page > 1 ? <Link href={href(result.page - 1)} className="font-semibold text-(--brand-accent)">← Önceki</Link> : <span />}
            <span className="text-muted-foreground">Sayfa {result.page} / {result.pages}</span>
            {result.page < result.pages ? <Link href={href(result.page + 1)} className="font-semibold text-(--brand-accent)">Sonraki →</Link> : <span />}
          </nav>
        )}
      </AreaCard>
    </AreaShell>
  );
}
