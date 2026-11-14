import { notFound } from "next/navigation";

import { AreaShell } from "@/components/areas/AreaShell";
import { ThemeForm } from "@/components/content/ThemeForm";
import { getContentOptions, getSite } from "@/lib/content";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { isThemeSection, THEME_SECTIONS } from "@/lib/theme-sections";

export default async function ThemeSectionPage({ params }: { params: Promise<{ bolum: string }> }) {
  const { bolum } = await params;
  // Yalnızca bilinen bölümler (adres çubuğundan rastgele değer gelirse 404)
  if (!isThemeSection(bolum)) notFound();
  const section = THEME_SECTIONS[bolum];

  const [s, o] = await Promise.all([getSite(), getContentOptions()]);
  const str = (v: string | null) => v ?? "";
  return (
    <AreaShell icon={section.icon} title={section.title} description={section.description} back={{ href: "/dashboard", label: "Dashboard" }}>
      <ThemeForm
        section={bolum}
        fonts={o.fonts}
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
          metaTitle: str(s.metaTitle),
          metaDescription: str(s.metaDescription),
        }}
      />
    </AreaShell>
  );
}
