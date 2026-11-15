"use client";

import { useRef, useState } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Film, Loader2, Trash2, Upload } from "lucide-react";

import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import { Button } from "@/components/ui/button";
import { mediaSrc } from "@/lib/media-src";
import { uploadVideo } from "@/lib/upload-video";
import { VIDEO_ACCEPT } from "@/lib/validations/media";

type Props<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  control: Control<T>;
  mediaBaseUrl: string;
  description?: string;
  /** Alan boşken sitede oynayan varsayılan video (önizleme için) */
  fallbackSrc?: string | null;
};

/**
 * Video alanı: önizleme, Medya'dan seç, bilgisayardan yükle (MP4/WebM, 25 MB), kaldır.
 * İstenirse adres de yapıştırılabilir (ör. Cloudinary video bağlantısı); asıl doğrulama API'de.
 */
export function VideoUploadField<T extends FieldValues>({ name, label, control, mediaBaseUrl, description, fallbackSrc = null }: Props<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = typeof field.value === "string" ? field.value.trim() : "";
        const src = value ? mediaSrc(value, mediaBaseUrl) : fallbackSrc;

        async function handleFile(file: File | undefined) {
          if (!file) return;
          setError(null);
          setUploading(true);
          const result = await uploadVideo(file);
          setUploading(false);
          if (result.success) field.onChange(result.url);
          else setError(result.error);
        }

        return (
          <div className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <div className="relative flex aspect-video max-w-md items-center justify-center overflow-hidden rounded-2xl border border-border bg-black">
              {src ? (
                <video key={src} src={src} muted loop autoPlay playsInline preload="metadata" className="size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs text-white/70">
                  <Film className="size-5" /> Video seçilmedi
                </span>
              )}
              {!value && src && (
                <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Varsayılan</span>
              )}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-sm text-white">
                  <Loader2 className="size-4 animate-spin" /> Yükleniyor…
                </span>
              )}
            </div>
            <div className="flex max-w-md gap-2">
              <input
                ref={field.ref}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                maxLength={500}
                placeholder="Video adresi ya da Seç / Yükle"
                aria-invalid={!!fieldState.error}
                aria-label={`${label} adresi`}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--brand-accent)/40"
              />
              <MediaPickerDialog type="video" mediaBaseUrl={mediaBaseUrl} current={value} disabled={uploading} onPick={(url) => field.onChange(url)} />
              <input
                ref={inputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label={`${label} için video yükle`}
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
              <Button type="button" variant="outline" className="h-10 shrink-0 gap-2 px-3" disabled={uploading} title="Bilgisayardan yükle" aria-label="Bilgisayardan video yükle" onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" />
              </Button>
              {value && (
                <Button type="button" variant="ghost" className="h-10 shrink-0 px-3 text-destructive" aria-label="Videoyu kaldır (varsayılana dön)" onClick={() => field.onChange("")}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {(error || fieldState.error?.message) && (
              <p role="alert" className="text-sm text-destructive">
                {error ?? fieldState.error?.message}
              </p>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        );
      }}
    />
  );
}
