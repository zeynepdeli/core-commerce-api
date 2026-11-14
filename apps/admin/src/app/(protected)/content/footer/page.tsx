import { PanelBottom } from "lucide-react";

import { AreaShell } from "@/components/areas/AreaShell";
import { FooterForm } from "@/components/content/FooterForm";
import { getContentOptions, getFooter, getSite } from "@/lib/content";

export default async function FooterPage() {
  const [f, o, s] = await Promise.all([getFooter(), getContentOptions(), getSite()]);
  const str = (v: string | null) => v ?? "";
  return (
    <AreaShell
      icon={PanelBottom}
      title="Footer"
      description="Sitenin en altındaki bölüm: marka metni, sosyal medya, iletişim, sayfa bağlantıları, kampanya kutusu ve telif yazısı."
      back={{ href: "/dashboard", label: "Dashboard" }}
    >
      <FooterForm
        icons={o.footerIcons}
        maxLinks={o.maxFooterLinks}
        siteName={s.siteName}
        pages={f.pages.map(({ id, title, isPublished }) => ({ id, title, isPublished }))}
        initial={{
          description: str(f.description),
          socialLinks: f.socialLinks,
          pagesTitle: f.pagesTitle,
          contactTitle: f.contactTitle,
          showCampaign: f.showCampaign,
          campaignTitle: f.campaignTitle,
          campaignText: str(f.campaignText),
          campaignButtonLabel: f.campaignButtonLabel,
          campaignButtonLink: f.campaignButtonLink,
          copyrightText: str(f.copyrightText),
          contactEmail: str(f.contactEmail),
          contactPhone: str(f.contactPhone),
          contactWhatsapp: str(f.contactWhatsapp),
          contactAddress: str(f.contactAddress),
          workingHours: str(f.workingHours),
          footerPageIds: f.pages.filter((p) => p.showInFooter).map((p) => p.id),
        }}
      />
    </AreaShell>
  );
}
