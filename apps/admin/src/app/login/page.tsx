import { LoginForm } from "./LoginForm";

export const metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sifre?: string | string[] }>;
}) {
  const { sifre } = await searchParams;
  return <LoginForm resetDone={sifre === "yenilendi"} />;
}
