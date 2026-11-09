"use client";

import { useId, useRef, useState } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";

import { uploadImageAction } from "@/app/actions/media";
import { imageUrlSchema } from "@/lib/validations/common";
import { IMAGE_ACCEPT, validateImageFile } from "@/lib/validations/media";

type ImageUploadFieldProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  control: Control<T>;
  mediaBaseUrl: string;
  description?: string;
  required?: boolean;
  /** @deprecated Önizleme artık sabit yükseklikte; geriye dönük uyumluluk için */
  previewClassName?: string;
};

// Doğrulanmış adresi tarayıcıda gösterilebilir hale getirir
function toPreviewSrc(value: string, mediaBaseUrl: string): string | null {
  if (!value || !imageUrlSchema.safeParse(value).success) {
    return null;
  }

  return value.startsWith("/media/") ? `${mediaBaseUrl}${value}` : value;
}

export function ImageUploadField<T extends FieldValues>({
  name,
  label,
  control,
  mediaBaseUrl,
  description = "JPG, PNG veya WEBP — en fazla 5 MB.",
  required = false,
}: ImageUploadFieldProps<T>) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const value = typeof field.value === "string" ? field.value : "";
        const previewSrc = toPreviewSrc(value, mediaBaseUrl);
        const errorMessage = uploadError ?? fieldState.error?.message;

        async function handleFileChange(
          event: React.ChangeEvent<HTMLInputElement>,
        ) {
          const file = event.target.files?.[0];
          // Aynı dosya tekrar seçilebilsin
          event.target.value = "";

          if (!file) return;

          setUploadError(null);

          // Hızlı geri bildirim için tarayıcıda ön kontrol
          const clientError = validateImageFile(file);
          if (clientError) {
            setUploadError(clientError);
            return;
          }

          setUploading(true);

          const formData = new FormData();
          formData.append("file", file);

          const result = await uploadImageAction(formData);

          setUploading(false);

          if (!result.success) {
            setUploadError(result.error);
            return;
          }

          field.onChange(result.url);
        }

        return (
          <Field data-invalid={!!errorMessage}>
            <FieldLabel htmlFor={inputId}>
              {label}
              {required && (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              )}
            </FieldLabel>

            {/* Adres + SEÇ + yükle */}
            <div className="flex gap-2">
              <Input
                ref={field.ref}
                id={inputId}
                name={field.name}
                value={value}
                onChange={(event) => {
                  setUploadError(null);
                  field.onChange(event.target.value);
                }}
                onBlur={field.onBlur}
                placeholder="/media/... veya https://..."
                spellCheck={false}
                autoComplete="off"
                className="h-10 min-w-0 flex-1"
                aria-invalid={!!errorMessage}
              />
              <MediaPickerDialog
                mediaBaseUrl={mediaBaseUrl}
                current={value}
                disabled={uploading}
                onPick={(url) => {
                  setUploadError(null);
                  field.onChange(url);
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label={`${label} için dosya yükle`}
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 gap-2 px-3"
                disabled={uploading}
                title="Bilgisayardan yükle"
                aria-label="Bilgisayardan yükle"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
              </Button>
            </div>

            {/* Büyük önizleme */}
            <div
              className={`group relative flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted p-2`}
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : previewSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt={`${label} önizlemesi`}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      field.onChange("");
                    }}
                    aria-label={`${label} görselini kaldır`}
                    title="Kaldır"
                    className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-destructive shadow-sm transition hover:bg-white"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="size-5" />
                  Görsel seçilmedi
                </span>
              )}
            </div>

            {errorMessage ? (
              <FieldErrorMessage>{errorMessage}</FieldErrorMessage>
            ) : (
              <FieldDescription>{description}</FieldDescription>
            )}
          </Field>
        );
      }}
    />
  );
}
