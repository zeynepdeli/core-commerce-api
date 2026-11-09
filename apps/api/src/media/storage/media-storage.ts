/** Görsel dosyalarının saklandığı yer (sunucu diski veya Cloudinary) */
export interface MediaStorage {
  readonly kind: 'local' | 'cloudinary';
  /** Dosyayı sakla; veritabanına yazılacak anahtar ve herkese açık adres döner */
  save(input: { id: string; extension: string; buffer: Buffer; mimeType: string }): Promise<{ storageKey: string; url: string }>;
  /** Dosyayı sil (yoksa sessizce geç) */
  remove(storageKey: string): Promise<void>;
}

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');
