import type { Metadata, Viewport } from "next";
import Notificacoes from "@/components/Notificacoes";
import "./globals.css";
import "@/styles/layout.css";
import "@/styles/dashboard.css";
import "@/styles/login.css";

export const metadata: Metadata = {
  title: "Fisiomed ABA | Gestão de Convênios",
  description: "Sistema de Gestão de Autorizações de Convênios da Fisiomed ABA",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#main-content" className="skip-link">
          Ir para o conteúdo principal
        </a>
        {children}
        <Notificacoes />
      </body>
    </html>
  );
}
