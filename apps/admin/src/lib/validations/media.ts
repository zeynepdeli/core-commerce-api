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
