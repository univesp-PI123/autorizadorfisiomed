import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessaoDaPagina } from "@/lib/auth/sessao";
import { version } from "../../../package.json";
import FormLogin from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ expirou?: string }>;
}) {
  if (await sessaoDaPagina()) redirect("/dashboard");
  const { expirou } = await searchParams;
  return <FormLogin sessaoExpirou={expirou === "1"} versao={version} ano={new Date().getFullYear()} />;
}
