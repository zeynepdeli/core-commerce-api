import { BookOpenText } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { AboutForm, type AboutValues } from "@/components/content/AboutForm";
import { getAbout } from "@/lib/content";
import { envUrl } from "@/lib/env-url";
import { getMediaBaseUrl } from "@/lib/media-base-url";

export default async function AboutPage() {
  const { isPublished, ...about } = await getAbout();
  // Formda boş alan "" (API boş metni null olarak saklar)
  const initial = {
    isPublished,
    ...Object.fromEntries(Object.entries(about).map(([k, v]) => [k, v ?? ""])),
  } as AboutValues;
  return (
    <AreaShell
      icon={BookOpenText}
      title="Hakkımızda"
      description="Vizyon, misyon, hikaye ve değerler bölümleri: metinler, görseller ve arka plan çizimleri."
      back={{ href: "/dashboard", label: "Dashboard" }}
    >
      <AboutForm
        initial={initial}
        mediaBaseUrl={getMediaBaseUrl()}
        storefrontUrl={envUrl("STOREFRONT_URL")}
      />
    </AreaShell>
  );
}
