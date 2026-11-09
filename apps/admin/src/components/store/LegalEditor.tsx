"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { z } from "zod";

import { AreaCard } from "@/components/areas/AreaShell";
import { FormField } from "@/components/forms/FormField";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/ui/button";
import { saveLegalAction } from "@/app/actions/store";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { legalSchema } from "@/lib/validations/store.schema";

type Values = z.infer<typeof legalSchema>;

export function LegalEditor({ type, title, content, version }: { type: string; title: string; content: string; version: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(legalSchema), defaultValues: { title, content } });
  useUnsavedChanges(isDirty && !isSubmitting);

  async function submit(values: Values) {
    setError(null);
    setSaved(false);
    const result = await saveLegalAction(type, values);
    if (!result.success) return setError(result.error);
    reset(values);
    setSaved(true);
    router.refresh();
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)}>
      <AreaCard title={title} hint={version === 0 ? "Varsayılan şablon (henüz düzenlenmedi)" : `Sürüm ${version} — her kaydedişte artar; siparişlerde onaylanan sürüm saklanır.`}>
        <div className="space-y-4">
          <FormField name="title" label="Başlık" register={register} error={errors.title} />
          <FormTextarea name="content" label="Metin" rows={16} register={register} error={errors.content} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            {saved && !isDirty && (
              <span role="status" className="mr-auto flex items-center gap-1.5 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" />
                Kaydedildi
              </span>
            )}
            <Button type="submit" disabled={isSubmitting || !isDirty} className="min-h-11 gap-2 px-6">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Metni Kaydet
            </Button>
          </div>
        </div>
      </AreaCard>
    </form>
  );
}
