import "server-only";

/**
 * Önizlemelerde /media/... görsellerini göstermek için TARAYICININ
 * erişebileceği API adresi. (API_URL sunucu içi bir adres olabilir.)
 */
export function getMediaBaseUrl(): string {
  return (process.env.API_PUBLIC_URL ?? process.env.API_URL ?? "").replace(
    /\/$/,
    "",
  );
}
