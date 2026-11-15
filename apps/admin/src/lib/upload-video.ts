import { validateVideoFile } from "@/lib/validations/media";

/** Tarayıcıdan video yükler (admin'in /api/media/video ucu üzerinden API'ye). */
export async function uploadVideo(file: File): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const clientError = validateVideoFile(file);
  if (clientError) return { success: false, error: clientError };

  const body = new FormData();
  body.append("file", file, file.name);
  try {
    const response = await fetch("/api/media/video", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as { success?: boolean; url?: string; error?: string } | null;
    if (response.ok && data?.success && typeof data.url === "string") return { success: true, url: data.url };
    return { success: false, error: data?.error ?? "Video yüklenemedi." };
  } catch {
    return { success: false, error: "Bağlantı hatası. Video yüklenemedi." };
  }
}
