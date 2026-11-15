import { describe, expect, it } from 'vitest';

import { parseRange } from './media.controller.js';
import {
  MAX_VIDEO_BYTES,
  isWellFormedMp4,
  validateVideo,
} from './video-file-validator.js';

/** Basit MP4 kutusu: 4 bayt boyut + 4 karakter tür + içerik */
const box = (type: string, payload: Buffer = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
};
const ftyp = box(
  'ftyp',
  Buffer.concat([
    Buffer.from('isom'),
    Buffer.from([0, 0, 2, 0]),
    Buffer.from('isomiso2avc1mp41'),
  ]),
);
const mp4 = Buffer.concat([
  ftyp,
  box('moov', Buffer.alloc(32)),
  box('mdat', Buffer.alloc(64, 1)),
]);

describe('video doğrulama', () => {
  it('düzgün MP4 kabul edilir', async () => {
    expect(isWellFormedMp4(mp4)).toBe(true);
    await expect(validateVideo(mp4)).resolves.toMatchObject({
      mimeType: 'video/mp4',
      extension: 'mp4',
      size: mp4.length,
    });
  });

  it('kutuların dışına eklenmiş içerik (polyglot) reddedilir', async () => {
    const polyglot = Buffer.concat([
      mp4,
      Buffer.from('<script>alert(1)</script>'),
    ]);
    expect(isWellFormedMp4(polyglot)).toBe(false);
    await expect(validateVideo(polyglot)).rejects.toThrow('bozuk');
  });

  it('eksik kutu, tutarsız boyut ve yanlış başlangıç reddedilir', () => {
    expect(isWellFormedMp4(Buffer.concat([ftyp, box('moov')]))).toBe(false); // mdat yok
    const broken = Buffer.from(mp4);
    broken.writeUInt32BE(9999, ftyp.length); // moov boyutu dosyadan büyük
    expect(isWellFormedMp4(broken)).toBe(false);
    expect(
      isWellFormedMp4(Buffer.concat([box('moov'), ftyp, box('mdat')])),
    ).toBe(false); // ilk kutu ftyp değil
  });

  it('görsel, metin ve boş dosya video diye kabul edilmez', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    await expect(validateVideo(png)).rejects.toThrow('Yalnızca MP4 ve WebM');
    await expect(validateVideo(Buffer.from('merhaba'))).rejects.toThrow(
      'Yalnızca MP4 ve WebM',
    );
    await expect(validateVideo(Buffer.alloc(0))).rejects.toThrow('boş');
  });

  it('25 MB üstü reddedilir', async () => {
    await expect(
      validateVideo(Buffer.alloc(MAX_VIDEO_BYTES + 1)),
    ).rejects.toThrow('25 MB');
  });
});

describe('Range (videoyu parça parça sunma)', () => {
  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=100-', { start: 100, end: 999 }],
    ['bytes=-200', { start: 800, end: 999 }],
    ['bytes=900-5000', { start: 900, end: 999 }],
    ['bytes=0-0', { start: 0, end: 0 }],
  ])('%s', (header, expected) => {
    expect(parseRange(header, 1000)).toEqual(expected);
  });

  it('dosya dışı aralık → 416', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=50-10', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable');
  });

  it('başlık yok, tanınmayan biçim ya da çok aralık → tüm dosya', () => {
    expect(parseRange(undefined, 1000)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 1000)).toBeNull();
    expect(parseRange('items=0-5', 1000)).toBeNull();
    expect(parseRange('bytes=-', 1000)).toBeNull();
  });
});
