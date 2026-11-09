import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Şifre yenile", referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Yeni şifre belirleyin" description="Bağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
