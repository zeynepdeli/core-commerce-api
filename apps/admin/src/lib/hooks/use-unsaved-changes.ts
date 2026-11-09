"use client";

import { useEffect } from "react";

const MESSAGE =
  "Kaydedilmemiş değişiklikler var. Sayfadan çıkarsanız kaybolacak. Devam edilsin mi?";

/**
 * Formda kaydedilmemiş değişiklik varken sayfadan ayrılmayı uyarır:
 * - sekme kapatma / yenileme / adres çubuğu (beforeunload)
 * - admin içindeki bağlantılara tıklama (Next Link dahil)
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      if (!window.confirm(MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // capture: Next Link'in kendi tıklama işleyicisinden ÖNCE çalışsın
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
