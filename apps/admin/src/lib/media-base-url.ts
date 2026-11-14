import "server-only";

import { envUrl } from "@/lib/env-url";

/**
 * Önizlemelerde /media/... görsellerini göstermek için TARAYICININ
 * erişebileceği API adresi. (API_URL sunucu içi bir adres olabilir.)
 * API_PUBLIC_URL boşsa API_URL kullanılır.
 */
export function getMediaBaseUrl(): string {
  return envUrl("API_PUBLIC_URL", "API_URL");
}
