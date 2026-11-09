/**
 * Soft delete'te benzersiz alanları serbest bırakır: "tulum" → "tulum--silindi-1a2b3c4d".
 * Böylece aynı ad/adres yeni bir kayıtta tekrar kullanılabilir; silinen kayıt
 * (geçmiş siparişler için) veritabanında kalır.
 */
export function retiredValue(value: string, id: string): string {
  return `${value.slice(0, 120)}--silindi-${id.slice(0, 8)}`;
}
