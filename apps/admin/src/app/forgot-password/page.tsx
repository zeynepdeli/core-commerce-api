import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Şifremi unuttum" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Şifremi unuttum" description="E-posta adresinizi girin; şifre sıfırlama bağlantısı gönderelim.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
