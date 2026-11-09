const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Tulum Peyniri (500 g)" → "tulum-peyniri-500-g" (Türkçe karakterler sadeleşir) */
export function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]|i̇/g, (ch) => TR[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/, "");
}
