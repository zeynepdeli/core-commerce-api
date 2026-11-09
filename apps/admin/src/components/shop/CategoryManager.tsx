"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeOff, FolderOpen, Loader2, Pencil, Plus, Save } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { OrderButtons, swapIds } from "@/components/common/OrderButtons";
import { FormField } from "@/components/forms/FormField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "@/app/actions/shop";
import { mediaSrc } from "@/lib/media-src";
import { slugify } from "@/lib/slugify";
import {
  categoryDefaultValues,
  categorySchema,
  type CategoryFormValues,
} from "@/lib/validations/shop.schema";

export type CategoryRow = CategoryFormValues & { id: string; productCount: number };

export function CategoryManager({ categories, mediaBaseUrl }: { categories: CategoryRow[]; mediaBaseUrl: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open(target: CategoryRow | "new") {
    setFormKey((k) => k + 1);
    setEditing(target);
  }

  function move(index: number, direction: -1 | 1) {
    const ids = swapIds(categories.map((c) => c.id), index, direction);
    if (!ids) return;
    setError(null);
    startTransition(async () => {
      const result = await reorderCategoriesAction(ids);
      if (!result.success) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => open("new")} className="min-h-11 gap-2 px-5 font-semibold">
          <Plus className="size-4" />
          Kategori Ekle
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {categories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <FolderOpen className="size-6" />
          Henüz kategori yok. Ürünleri gruplamak için ilk kategoriyi ekleyin.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {categories.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-4 p-4">
              <OrderButtons index={index} total={categories.length} disabled={pending} onMove={(d) => move(index, d)} />
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
                {category.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(category.image, mediaBaseUrl)} alt="" className="size-full object-cover" />
                ) : (
                  <FolderOpen className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-(--brand-primary)">
                  {category.name}
                  {!category.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                      <EyeOff className="size-3" />
                      Gizli
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  /{category.slug} · {category.productCount} ürün
                </p>
              </div>
              <Button type="button" variant="outline" aria-label={`${category.name} kategorisini düzenle`} onClick={() => open(category)} className="size-9 p-0">
                <Pencil className="size-4" />
              </Button>
              <ConfirmDeleteDialog
                title={`"${category.name}" silinsin mi?`}
                description={
                  category.productCount > 0
                    ? `Bu kategoride ${category.productCount} ürün var; önce ürünleri başka bir kategoriye taşımalısınız.`
                    : "Bu işlem geri alınamaz."
                }
                onConfirm={() => deleteCategoryAction(category.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing === "new" ? "Yeni Kategori" : "Kategoriyi Düzenle"}</DialogTitle>
            <DialogDescription>Kategori adı, adresi, görseli ve arama motoru bilgileri.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <CategoryForm
              key={formKey}
              target={editing}
              mediaBaseUrl={mediaBaseUrl}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({
  target,
  mediaBaseUrl,
  onCancel,
  onDone,
}: {
  target: CategoryRow | "new";
  mediaBaseUrl: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const isNew = target === "new";
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: isNew ? categoryDefaultValues : target,
  });

  // Yeni kategoride adres, ad yazıldıkça otomatik oluşur (elle değiştirilene kadar)
  const name = useWatch({ control, name: "name" });
  const slugTouched = !isNew || !!dirtyFields.slug;
  useEffect(() => {
    if (!slugTouched) setValue("slug", slugify(name));
  }, [name, slugTouched, setValue]);

  async function submit(values: CategoryFormValues) {
    setSubmitError(null);
    const result = isNew ? await createCategoryAction(values) : await updateCategoryAction(target.id, values);
    if (!result.success) {
      setSubmitError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="@container space-y-5">
      <div className="grid gap-5 @xl:grid-cols-2">
        <FormField name="name" label="Kategori Adı" register={register} error={errors.name} required />
        <FormField
          name="slug"
          label="Adres"
          description="Sitede /kategori/<adres> olarak görünür."
          register={register}
          error={errors.slug}
          required
        />
      </div>
      <FormTextarea name="description" label="Açıklama" rows={3} register={register} error={errors.description} />
      <ImageUploadField name="image" label="Kategori Görseli" control={control} mediaBaseUrl={mediaBaseUrl} />
      <FormSwitch name="isActive" label="Yayında" description="Kapalıysa kategori ve içindeki ürünler sitede görünmez." control={control} />

      <fieldset className="space-y-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Arama Motoru (SEO)</legend>
        <FormField name="metaTitle" label="SEO Başlığı" description="Boşsa kategori adı kullanılır." register={register} error={errors.metaTitle} />
        <FormTextarea name="metaDescription" label="SEO Açıklaması" rows={2} register={register} error={errors.metaDescription} />
      </fieldset>

      {submitError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          İptal
        </Button>
        <Button type="submit" disabled={isSubmitting || (!isNew && !isDirty)} className="min-h-11 gap-2 px-5">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? "Kaydediliyor..." : "Kategoriyi Kaydet"}
        </Button>
      </div>
    </form>
  );
}
