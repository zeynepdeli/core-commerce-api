import { ShieldCheck, UserCog } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { PasswordForm } from "@/components/account/PasswordForm";
import { TwoFactorManage } from "@/components/account/TwoFactorManage";
import { TwoFactorSetup } from "@/components/account/TwoFactorSetup";
import { adminFetch } from "@/lib/api";

type Status = { enabled: boolean; enabledAt: string | null; required: boolean; recoveryCodesRemaining: number };
const fmt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" });

export default async function AccountPage() {
  const response = await adminFetch("/account/2fa");
  const status = response.ok ? ((await response.json()) as Status) : null;

  return (
    <AreaShell icon={UserCog} title="Hesap Ayarları" description="Yönetici hesabınızın güvenlik ayarları.">
      <AreaCard title="Şifre Değiştir" hint="Şifre değişince diğer tüm cihazlardaki oturumlar kapanır.">
        <PasswordForm />
      </AreaCard>
      {status && (
        <AreaCard
          title="İki Adımlı Doğrulama"
          hint="Şifreniz ele geçirilse bile telefonunuzdaki kod olmadan panele girilemez."
        >
          <TwoFactorSetup
            next="/account"
            enabled={status.enabled}
            whenEnabled={
              <div className="grid gap-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <ShieldCheck className="size-4" /> Açık{status.enabledAt ? ` · ${fmt.format(new Date(status.enabledAt))}` : ""}
                </p>
                <TwoFactorManage remaining={status.recoveryCodesRemaining} required={status.required} />
              </div>
            }
          />
        </AreaCard>
      )}
    </AreaShell>
  );
}
