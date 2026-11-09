import { randomInt } from 'node:crypto';

// Karışabilecek karakterler yok (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** "2026-7K3M9Q2X": tahmin edilemez, sıralı değil (günlük sipariş sayısı sızmaz) */
export function newOrderNumber(now = new Date()): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${now.getFullYear()}-${suffix}`;
}
