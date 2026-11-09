"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Lock, LockOpen, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setUserActiveAction, setUserRoleAction, unlockUserAction } from "@/app/actions/users";

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
  verified: boolean;
  google: boolean;
  isActive: boolean;
  deleted: boolean;
  locked: boolean;
  createdAt: string;
  isMe: boolean;
};

const ROLE_LABEL = { CUSTOMER: "Müşteri", ADMIN: "Yönetici", SUPER_ADMIN: "Süper Yönetici" } as const;

export function UsersList({ users, canChangeRoles }: { users: UserListRow[]; canChangeRoles: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    start(async () => {
      setError(null);
      const result = await action();
      if (!result.success) setError(result.error ?? "İşlem yapılamadı.");
      router.refresh();
    });
  }

  if (users.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Bu filtreye uyan kullanıcı yok.</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-2xl border border-border" aria-busy={pending}>
        {users.map((u) => {
          const staff = u.role !== "CUSTOMER";
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  u.isActive && !u.deleted ? "bg-(--brand-primary)/10 text-(--brand-primary)" : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {staff ? <ShieldCheck className="size-4" /> : <UserRound className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`flex flex-wrap items-center gap-2 font-medium ${u.deleted ? "text-muted-foreground line-through" : ""}`}>
                  <span className="truncate">{u.name}</span>
                  {u.isMe && <Badge tone="accent">Siz</Badge>}
                  {staff && <Badge tone="primary">{ROLE_LABEL[u.role]}</Badge>}
                  {u.locked && <Badge tone="danger">Kilitli</Badge>}
                  {u.deleted && <Badge tone="muted">Hesap kapatıldı</Badge>}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{u.email}</span>
                  {u.verified && <BadgeCheck className="size-3.5 text-emerald-600" aria-label="E-posta doğrulandı" />}
                  {u.google && <span>· Google</span>}
                  <span>· Kayıt: {u.createdAt}</span>
                </p>
              </div>

              {u.locked && !u.deleted && (
                <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => unlockUserAction(u.id))} className="h-9 gap-1.5 px-3 text-xs">
                  <LockOpen className="size-3.5" />
                  Kilidi aç
                </Button>
              )}

              {canChangeRoles && !u.isMe && !u.deleted && (
                <label className="flex items-center gap-2 text-xs">
                  <span className="sr-only">{u.email} rolü</span>
                  <select
                    value={u.role}
                    disabled={pending}
                    onChange={(e) => {
                      const role = e.target.value;
                      if (role !== "CUSTOMER" && !confirm(`${u.email} kişisine "${ROLE_LABEL[role as keyof typeof ROLE_LABEL]}" yetkisi verilsin mi? Yönetim paneline erişebilecek.`)) {
                        e.target.value = u.role;
                        return;
                      }
                      run(() => setUserRoleAction(u.id, role));
                    }}
                    className="h-9 rounded-lg border border-border bg-surface px-2"
                  >
                    {Object.entries(ROLE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!u.deleted && (
                <label className="flex items-center gap-2 text-sm">
                  {u.isActive ? "Aktif" : "Askıda"}
                  <Switch
                    checked={u.isActive}
                    disabled={pending || u.isMe || (staff && !canChangeRoles)}
                    aria-label={`${u.email} hesabı ${u.isActive ? "aktif" : "askıda"}`}
                    title={u.isMe ? "Kendi hesabınızı askıya alamazsınız" : staff && !canChangeRoles ? "Yönetici hesaplarını yalnızca süper yönetici değiştirebilir" : undefined}
                    onCheckedChange={(isActive) => run(() => setUserActiveAction(u.id, isActive))}
                  />
                </label>
              )}
              {u.deleted && <Lock className="size-4 text-muted-foreground" aria-label="Kapatılmış hesap" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Badge({ tone, children }: { tone: "primary" | "accent" | "danger" | "muted"; children: React.ReactNode }) {
  const cls = {
    primary: "bg-(--brand-primary)/10 text-(--brand-primary)",
    accent: "bg-(--brand-accent)/10 text-(--brand-accent)",
    danger: "bg-red-500/10 text-red-700",
    muted: "bg-neutral-500/10 text-neutral-600",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
