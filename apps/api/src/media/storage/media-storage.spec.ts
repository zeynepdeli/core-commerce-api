import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CloudinaryMediaStorage, signCloudinary } from './cloudinary-media.storage.js';
import { LocalMediaStorage } from './local-media.storage.js';

describe('signCloudinary', () => {
  it('parametreleri sıralayıp secret ile SHA-256 imzalar', () => {
    const a = signCloudinary({ timestamp: 1, folder: 'f', public_id: 'p' }, 'secret');
    const b = signCloudinary({ public_id: 'p', folder: 'f', timestamp: 1 }, 'secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(signCloudinary({ timestamp: 1, folder: 'f', public_id: 'p' }, 'baska'));
  });
});

describe('CloudinaryMediaStorage', () => {
  const config = { cloudName: 'demo', apiKey: '123456789', apiSecret: 'super-secret-value', folder: 'site' };

  it('imzalı yükler, secret göndermez, güvenli adresi döner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ public_id: 'site/abc', secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/site/abc.webp' }),
    });
    const storage = new CloudinaryMediaStorage(config, fetchMock as never);
    const result = await storage.save({ id: 'abc', extension: 'webp', buffer: Buffer.from('x'), mimeType: 'image/webp' });
    expect(result).toEqual({ storageKey: 'site/abc', url: 'https://res.cloudinary.com/demo/image/upload/v1/site/abc.webp' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    const form = init.body as FormData;
    expect(form.get('signature')).toMatch(/^[0-9a-f]{64}$/);
    expect([...form.values()].some((v) => v === config.apiSecret)).toBe(false);
  });

  it('beklenmeyen adres dönerse kaydetmez', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ public_id: 'p', secure_url: 'javascript:alert(1)' }) });
    const storage = new CloudinaryMediaStorage(config, fetchMock as never);
    await expect(storage.save({ id: 'p', extension: 'png', buffer: Buffer.from('x'), mimeType: 'image/png' })).rejects.toThrow();
  });
});

describe('LocalMediaStorage', () => {
  it('yazar ve yol geçişi (../) içeren anahtarı silmez', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'media-'));
    const storage = new LocalMediaStorage(dir);
    const { storageKey, url } = await storage.save({ id: '11111111-1111-4111-8111-111111111111', extension: 'png', buffer: Buffer.from('x') });
    expect(url).toBe(`/media/${storageKey}`);
    await storage.remove('../../etc/passwd');
    expect(await readdir(dir)).toEqual([storageKey]);
    await storage.remove(storageKey);
    expect(await readdir(dir)).toEqual([]);
  });
});
