import { Globe } from "lucide-react";
import { siFacebook, siInstagram, siPinterest, siTelegram, siTiktok, siWhatsapp, siX, siYoutube, type SimpleIcon } from "simple-icons";

/** API'deki FOOTER_ICONS ile aynı anahtarlar. Mağaza sitesi de aynı ikonları çizer. */
export const FOOTER_ICON_META: Record<string, { label: string; placeholder: string; icon?: SimpleIcon }> = {
  instagram: { label: "Instagram", placeholder: "https://www.instagram.com/…", icon: siInstagram },
  facebook: { label: "Facebook", placeholder: "https://www.facebook.com/…", icon: siFacebook },
  x: { label: "X (Twitter)", placeholder: "https://x.com/…", icon: siX },
  youtube: { label: "YouTube", placeholder: "https://www.youtube.com/@…", icon: siYoutube },
  tiktok: { label: "TikTok", placeholder: "https://www.tiktok.com/@…", icon: siTiktok },
  pinterest: { label: "Pinterest", placeholder: "https://www.pinterest.com/…", icon: siPinterest },
  whatsapp: { label: "WhatsApp", placeholder: "https://wa.me/905321234567", icon: siWhatsapp },
  telegram: { label: "Telegram", placeholder: "https://t.me/…", icon: siTelegram },
  web: { label: "Web sitesi", placeholder: "https://…" },
};

/** İkon önizlemesi (dekoratif) */
export function FooterIcon({ name, className }: { name: string; className?: string }) {
  const icon = FOOTER_ICON_META[name]?.icon;
  if (!icon) return <Globe aria-hidden className={className} />;
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={icon.path} />
    </svg>
  );
}
