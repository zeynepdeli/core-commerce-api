import { redirect } from "next/navigation";

/** Görünüm artık dört ayrı ekran (dashboard'da dört kutu); eski adres ilkine yönlenir. */
export default function ThemePage() {
  redirect("/content/theme/header");
}
