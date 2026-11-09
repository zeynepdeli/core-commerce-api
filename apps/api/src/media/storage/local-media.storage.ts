import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MediaStorage } from './media-storage.js';

const KEY_REGEX = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Sunucu diski: storage/media klasörü, /media/<anahtar> adresinden sunulur */
export class LocalMediaStorage implements MediaStorage {
  readonly kind = 'local' as const;

  constructor(private readonly directory = join(process.cwd(), 'storage', 'media')) {}

  async save({ id, extension, buffer }: { id: string; extension: string; buffer: Buffer }) {
    const storageKey = `${id}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    // wx: varsa üzerine yazma; 0600: yalnızca uygulama kullanıcısı okuyabilir
    await writeFile(join(this.directory, storageKey), buffer, { flag: 'wx', mode: 0o600 });
    return { storageKey, url: `/media/${storageKey}` };
  }

  async remove(storageKey: string) {
    // Yol geçişine (../) karşı: yalnızca kendi ürettiğimiz biçimdeki anahtarlar
    if (!KEY_REGEX.test(storageKey)) return;
    try {
      await unlink(join(this.directory, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
