import "server-only";

/**
 * Ortam değişkeninden adres okur; sondaki "/" atılır.
 * BOŞ değer ayarlanmamış sayılır ve sıradakine geçilir: .env'de `API_PUBLIC_URL=` gibi boş bırakılmış
 * bir satır yüzünden adres "" olup önizlemeler kırılmasın (`??` boş metni geçerli sayar, `||` saymaz).
 */
export function envUrl(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value.replace(/\/+$/, "");
  }
  return "";
}
