import { Scale } from "lucide-react";

import { AreaCard, AreaShell } from "@/components/areas/AreaShell";
import { LegalEditor } from "@/components/store/LegalEditor";
import { getLegalDocs } from "@/lib/store";

export default async function LegalPage() {
  const { documents, placeholders } = await getLegalDocs();
  return (
    <AreaShell
      icon={Scale}
      title="Yasal Metinler"
      description="Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, KVKK Aydınlatma Metni ve Çerez Politikası. Varsayılan şablonları hukukçunuzla gözden geçirin."
    >
      <AreaCard title="Yer Tutucular" hint="Metne yazdığınız bu alanlar sipariş anında doldurulur; doldurulmuş hali siparişe kanıt olarak kaydedilir.">
        <p className="flex flex-wrap gap-2">
          {placeholders.map((p) => (
            <code key={p} className="rounded-md bg-surface-muted px-2 py-1 text-xs">{`{{${p}}}`}</code>
          ))}
        </p>
      </AreaCard>
      {documents.map((d) => (
        <LegalEditor key={`${d.type}-${d.version}`} type={d.type} title={d.title} content={d.content} version={d.version} />
      ))}
    </AreaShell>
  );
}
