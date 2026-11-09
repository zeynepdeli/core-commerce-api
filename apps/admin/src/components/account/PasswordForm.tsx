"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/FormField";
import { changePasswordAction } from "@/app/actions/account";
import { passwordSchema, type PasswordFormValues } from "@/lib/validations/account.schema";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function submit(values: PasswordFormValues) {
    setError(null);
    setDone(false);
    const result = await changePasswordAction(values);
    if (!result.success) {
      setError(result.error);
      return;
    }
    reset();
    setDone(true);
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="grid max-w-xl gap-5">
      <FormField name="currentPassword" type="password" label="Mevcut Şifre" register={register} error={errors.currentPassword} autoComplete="current-password" required />
      <FormField name="newPassword" type="password" label="Yeni Şifre" description="En az 12 karakter. Uzun bir cümle kullanmak en güvenlisi." register={register} error={errors.newPassword} autoComplete="new-password" required />
      <FormField name="confirmPassword" type="password" label="Yeni Şifre (Tekrar)" register={register} error={errors.confirmPassword} autoComplete="new-password" required />

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.
        </p>
      )}

      <div>
        <Button type="submit" disabled={isSubmitting} className="min-h-11 gap-2 rounded-full px-7">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Şifreyi Değiştir
        </Button>
      </div>
    </form>
  );
}
