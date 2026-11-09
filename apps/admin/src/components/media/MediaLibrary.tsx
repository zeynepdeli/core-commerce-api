"use client";

import { mediaSrc } from "@/lib/media-src";
import { MediaAltField } from "./MediaAltField";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImageIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";

import { deleteMediaAction, uploadImageAction } from "@/app/actions/media";
import type { MediaFile } from "@/lib/media";
import { IMAGE_ACCEPT, validateImageFile } from "@/lib/validations/media";

type MediaLibraryProps = {
  files: MediaFile[];
  mediaBaseUrl: string;
};

const MAX_FILES_PER_BATCH = 10;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({ files, mediaBaseUrl }: MediaLibraryProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    const selected = Array.from(list).slice(0, MAX_FILES_PER_BATCH);
    const nextErrors: string[] = [];

    if (list.length > MAX_FILES_PER_BATCH) {
      nextErrors.push(
        `Tek seferde en fazla ${MAX_FILES_PER_BATCH} görsel yüklenebilir.`,
      );
    }

    // Sırayla yükle (sunucuyu aynı anda çok istekle yormamak için)
    for (const [index, file] of selected.entries()) {
      setUploading(`${index + 1}/${selected.length}`);

      const clientError = validateImageFile(file);
      if (clientError) {
        nextErrors.push(`${file.name}: ${clientError}`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadImageAction(formData);

      if (!result.success) nextErrors.push(`${file.name}: ${result.error}`);
    }

    setUploading(null);
    setErrors(nextErrors);
    router.refresh();
  }

  async function copyUrl(file: MediaFile) {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Pano erişimi yoksa sessizce geç
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={uploading !== null}
          onClick={() => inputRef.current?.click()}
          className="min-h-11 gap-2 px-5 font-semibold"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? `Yükleniyor ${uploading}` : "Görsel Yükle"}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG veya WEBP — en fazla 5 MB. Tek seferde {MAX_FILES_PER_BATCH}{" "}
          dosya.
        </p>
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <ImageIcon className="size-8" />
          <p>Henüz görsel yüklenmedi.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((file) => (
            <li
              key={file.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative flex aspect-square items-center justify-center bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaSrc(file.url, mediaBaseUrl)}
                  alt={file.alt || file.originalName}
                  loading="lazy"
                  className="size-full object-contain"
                />
                {file.inUse && (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Kullanımda
                  </span>
                )}
              </div>

              <div className="space-y-2 p-3">
                {/* Dosya adı kullanıcıdan gelir: React metni kaçışlar (XSS yok) */}
                <p
                  className="truncate text-sm font-medium"
                  title={file.originalName}
                >
                  {file.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
                <MediaAltField id={file.id} initial={file.alt ?? ""} />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 flex-1 gap-1.5 px-2 text-xs"
                    onClick={() => void copyUrl(file)}
                  >
                    {copiedId === file.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedId === file.id ? "Kopyalandı" : "Adresi Kopyala"}
                  </Button>

                  {file.inUse ? (
                    <span
                      className="inline-flex size-9 items-center justify-center text-xs text-muted-foreground"
                      title="Kullanımdaki görsel silinemez"
                    >
                      —
                    </span>
                  ) : (
                    <ConfirmDeleteDialog
                      title="Görseli sil"
                      description={
                        <>
                          <strong>{file.originalName}</strong> kalıcı olarak
                          silinecek.
                        </>
                      }
                      onConfirm={() => deleteMediaAction(file.id)}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
