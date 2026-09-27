import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { AlertaProvider } from "@/contextos/AlertaContexto";
import { SessaoProvider } from "@/contextos/SessaoContexto";
import { sessaoDaPagina } from "@/lib/auth/sessao";

// Todas as telas internas passam por aqui: sem sessão válida, vai para o login.
export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const usuario = await sessaoDaPagina();
  if (!usuario) redirect("/login");

  return (
    <SessaoProvider usuario={usuario}>
      <AlertaProvider>
        <MainLayout>{children}</MainLayout>
      </AlertaProvider>
    </SessaoProvider>
  );
}
