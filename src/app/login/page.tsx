import { redirect } from "next/navigation";
import { sessaoDaPagina } from "@/lib/auth/sessao";
import FormLogin from "./FormLogin";

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ expirou?: string }>;
}) {
  if (await sessaoDaPagina()) redirect("/dashboard");
  const { expirou } = await searchParams;
  return <FormLogin sessaoExpirou={expirou === "1"} />;
}
