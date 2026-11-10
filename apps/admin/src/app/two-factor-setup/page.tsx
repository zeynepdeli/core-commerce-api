import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { logoutAdmin } from "@/app/actions";
import { TwoFactorSetup } from "@/components/account/TwoFactorSetup";
import { BRAND } from "@/brand/brand";
import { getAdminUser } from "@/lib/auth";

export const metadata = { title: "İki Adımlı Doğrulama" };

/** Zorunlu kurulum ekranı: panel menüsü yok, kurulmadan devam edilemez */
export default async function TwoFactorSetupPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-3xl rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-primary/5 sm:p-9">
        <div className="mb-7 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">İki adımlı doğrulamayı açın</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {BRAND.name} yönetim paneline girmek için şifrenize ek olarak telefonunuzdaki bir kod gerekir. Bu, şifreniz çalınsa bile mağazanızı korur.
            </p>
          </div>
        </div>
        <TwoFactorSetup
          next="/dashboard"
          enabled={user.twoFactorEnabled}
          whenEnabled={
            <Link href="/dashboard" className="font-semibold text-(--brand-accent)">
              İki adımlı doğrulama açık. Panele git →
            </Link>
          }
        />
        <form action={logoutAdmin} className="mt-8 border-t border-border pt-5 text-right">
          <button type="submit" className="text-xs text-muted-foreground hover:underline">
            Çıkış yap ({user.email})
          </button>
        </form>
      </div>
    </main>
  );
}
