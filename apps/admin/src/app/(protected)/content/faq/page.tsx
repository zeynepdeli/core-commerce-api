import { CircleHelp } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { FaqManager } from "@/components/content/FaqManager";
import { getFaq } from "@/lib/content";

export default async function FaqPage() {
  const items = await getFaq();
  return (
    <AreaShell icon={CircleHelp} title="Sıkça Sorulan Sorular" description="Mağazanın S.S.S. sayfası. Kategoriye göre gruplanır; sıralamayı oklarla değiştirin." back={{ href: "/dashboard", label: "Dashboard" }}>
      <AreaCard title={`Sorular (${items.length})`}>
        <FaqManager key={items.map((i) => `${i.id}${i.isActive}`).join()} items={items} />
      </AreaCard>
    </AreaShell>
  );
}
