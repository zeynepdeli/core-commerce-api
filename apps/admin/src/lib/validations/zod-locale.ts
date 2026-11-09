import { z } from "zod";

/**
 * Özel mesaj verilmemiş kurallarda (ör. .max(40)) bile kullanıcı İngilizce
 * "Too big: expected string..." yerine anlaşılır Türkçe mesaj görsün.
 * Tüm şema dosyaları ve kök layout bu modülü içe aktarır (tarayıcı + sunucu).
 */
z.config(z.locales.tr());
z.config({
  customError: (issue) => {
    if (issue.origin !== "string") return undefined;
    if (issue.code === "too_big") return `En fazla ${String(issue.maximum)} karakter olabilir.`;
    if (issue.code === "too_small") {
      return Number(issue.minimum) <= 1 ? "Bu alan zorunludur." : `En az ${String(issue.minimum)} karakter olmalı.`;
    }
    return undefined;
  },
});
