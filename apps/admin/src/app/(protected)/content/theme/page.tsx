import { Palette } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { ThemeForm } from "@/components/content/ThemeForm";
import { getContentOptions, getSite } from "@/lib/content";
import { getMediaBaseUrl } from "@/lib/media-base-url";

export default async function ThemePage() {
  const [s, o] = await Promise.all([getSite(), getContentOptions()]);
  const str = (v: string | null) => v ?? "";
  return (
    <AreaShell icon={Palette} title="Görünüm" description="Mağaza sitesinin renkleri, yazı tipleri, logosu, duyuru şeridi ve iletişim bilgileri." back={{ href: "/dashboard", label: "Dashboard" }}>
      <ThemeForm
        fonts={o.fonts}
        networks={o.socialNetworks}
        mediaBaseUrl={getMediaBaseUrl()}
        initial={{
          siteName: s.siteName,
          primaryColor: s.primaryColor,
          secondaryColor: s.secondaryColor,
          backgroundColor: s.backgroundColor,
          textColor: s.textColor,
          fontHeading: s.fontHeading,
          fontBody: s.fontBody,
          logoUrl: s.logoUrl,
          faviconUrl: s.faviconUrl,
          backgroundImageUrl: str(s.backgroundImageUrl),
          backgroundImageFit: s.backgroundImageFit,
          cardTextureUrl: str(s.cardTextureUrl),
          ogImageUrl: str(s.ogImageUrl),
          announcementText: str(s.announcementText),
          announcementLink: str(s.announcementLink),
          contactEmail: str(s.contactEmail),
          contactPhone: str(s.contactPhone),
          contactWhatsapp: str(s.contactWhatsapp),
          contactAddress: str(s.contactAddress),
          workingHours: str(s.workingHours),
          metaTitle: str(s.metaTitle),
          metaDescription: str(s.metaDescription),
          social: Object.fromEntries(o.socialNetworks.map((n) => [n, s.socialLinks[n] ?? ""])),
        }}
      />
    </AreaShell>
  );
}
