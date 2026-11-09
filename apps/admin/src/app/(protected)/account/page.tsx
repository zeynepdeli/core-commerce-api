import { UserCog } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { PasswordForm } from "@/components/account/PasswordForm";

export default function AccountPage() {
  return (
    <AreaShell icon={UserCog} title="Hesap Ayarları" description="Yönetici hesabınızın güvenlik ayarları.">
      <AreaCard title="Şifre Değiştir" hint="Şifre değişince diğer tüm cihazlardaki oturumlar kapanır.">
        <PasswordForm />
      </AreaCard>
    </AreaShell>
  );
}
