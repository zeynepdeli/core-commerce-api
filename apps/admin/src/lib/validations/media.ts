// Tarayıcı ve sunucu tarafında ortak kullanılan yükleme kuralları.
// Not: Asıl kontrol API'de (dosya imzası + sharp ile yeniden işleme).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // API ile aynı: 5 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

export function validateImageFile(file: File): string | null {
  if (file.size === 0) {
    return "Dosya boş.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Görsel en fazla 5 MB olabilir.";
  }

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.";
  }

  return null;
}

// ───────────── Video ─────────────
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // API ile aynı: 25 MB
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const VIDEO_ACCEPT = ALLOWED_VIDEO_TYPES.join(",");

export function validateVideoFile(file: File): string | null {
  if (file.size === 0) return "Dosya boş.";
  if (file.size > MAX_VIDEO_BYTES) return "Video en fazla 25 MB olabilir. Daha kısa ya da düşük çözünürlüklü bir video deneyin.";
  if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) return "Yalnızca MP4 veya WebM video yükleyebilirsiniz.";
  return null;
}
