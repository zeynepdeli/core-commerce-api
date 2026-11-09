import { notFound } from "next/navigation";
import { CheckCircle2, Package } from "lucide-react";
import { z } from "zod";

import { AreaShell } from "@/components/areas/AreaShell";
import { DeleteProductButton } from "@/components/shop/DeleteProductButton";
import { ProductForm } from "@/components/shop/ProductForm";
import { getMediaBaseUrl } from "@/lib/media-base-url";
import { getAdminCategories, getAdminProduct, toProductFormValues } from "@/lib/shop";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yeni?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [product, categories, { yeni }] = await Promise.all([getAdminProduct(id), getAdminCategories(), searchParams]);
  if (!product) notFound();

  return (
    <AreaShell
      icon={Package}
      title={product.name}
      description={`Ürün Yönetimi · /${product.slug}`}
      back={{ href: "/shop/products", label: "Ürün Yönetimi" }}
      actions={<DeleteProductButton id={product.id} name={product.name} redirectTo="/shop/products" />}
    >
      {yeni === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" />
          Ürün oluşturuldu. Düzenlemeye devam edebilirsiniz.
        </p>
      )}
      <ProductForm
        key={product.id}
        productId={product.id}
        initialValues={toProductFormValues(product)}
        categories={categories.map(({ id: cid, name }) => ({ id: cid, name }))}
        mediaBaseUrl={getMediaBaseUrl()}
      />
    </AreaShell>
  );
}
