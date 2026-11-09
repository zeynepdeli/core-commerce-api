"use client";

import { useRouter } from "next/navigation";

import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { deleteProductAction } from "@/app/actions/shop";

export function DeleteProductButton({ id, name, redirectTo }: { id: string; name: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmDeleteDialog
      title={`"${name}" silinsin mi?`}
      description="Ürün, görselleri ve sekmeleriyle birlikte silinir. Bu işlem geri alınamaz. Satıştan kaldırmak için silmek yerine 'Yayında' anahtarını kapatabilirsiniz."
      onConfirm={async () => {
        const result = await deleteProductAction(id);
        if (result.success && redirectTo) router.replace(redirectTo);
        return result;
      }}
    />
  );
}
