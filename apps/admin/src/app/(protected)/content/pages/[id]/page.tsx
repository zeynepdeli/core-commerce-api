import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { z } from "zod";

import { AreaShell } from "@/components/areas/AreaShell";
import { PageForm } from "@/components/content/PageForm";
import { getPage } from "@/lib/content";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const page = isNew ? null : await getPage(id);
  if (!isNew && !page) notFound();
  const storefrontUrl = (process.env.STOREFRONT_URL ?? "").replace(/\/$/, "");
  return (
    <AreaShell icon={FileText} title={page ? page.title : "Yeni Sayfa"} description="Markdown ile yazın; mağaza güvenli biçimde (HTML'siz) gösterir." back={{ href: "/content/pages", label: "Sayfalar" }}>
      <PageForm
        id={page?.id ?? null}
        storefrontUrl={storefrontUrl}
        initial={{
          title: page?.title ?? "",
          slug: page?.slug ?? "",
          body: page?.body ?? "",
          metaTitle: page?.metaTitle ?? "",
          metaDescription: page?.metaDescription ?? "",
          isPublished: page?.isPublished ?? true,
          showInFooter: page?.showInFooter ?? true,
        }}
      />
    </AreaShell>
  );
}
