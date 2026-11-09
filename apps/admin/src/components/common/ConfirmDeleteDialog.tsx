"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmDeleteDialogProps = {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<{ success: true } | { success: false; error: string }>;
};

// Bölüm, kart vb. her türlü silme işlemi için ortak onay penceresi
export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Sil",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onConfirm();

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Silme işlemi sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        aria-label={title}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50"
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>

      <AlertDialogContent className="border-border bg-surface">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                {confirmLabel}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
