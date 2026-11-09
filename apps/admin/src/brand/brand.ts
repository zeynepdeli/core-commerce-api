/**
 * ✏️ MÜŞTERİYE ÖZEL: Admin panelinin adı ve logosu.
 * Logo: public/brand/ klasörüne koyup yolunu yazın (ör. "/brand/logo.svg").
 * Renkler ve yazı tipi: brand/theme.css
 */
export const BRAND = {
  name: "Core Commerce",
  /** Giriş ekranındaki alt yazı */
  tagline: "Yönetim Paneli",
  /** null = logo yerine ikon gösterilir */
  logo: null as string | null,
} as const;
