const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

/** "15m" → 900, "7d" → 604800 (biçim env doğrulamasında kontrol edilir) */
export function durationToSeconds(value: string): number {
  const match = /^(\d{1,5})([smhd])$/.exec(value);
  if (!match) throw new Error(`Geçersiz süre: ${value}`);
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
}
