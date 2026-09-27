import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { VLibras } from "@/components/Acessibilidade";
import Notificacoes from "@/components/Notificacoes";
import { SCRIPT_ACESSIBILIDADE } from "@/lib/acessibilidade";
import { CHAVE_TEMA } from "@/lib/tema";
import "@/styles/sobrio/tokens.css";
import "@/styles/sobrio/sobrio.css";
import "@/styles/app.css";

// Tipografia do Sóbrio. O next/font baixa as fontes no build e as serve do
// próprio site — o navegador não faz requisição ao Google.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fonte-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Fisiomed ABA", template: "%s — Fisiomed ABA" },
  description: "Sistema de Gestão de Autorizações de Convênios da Fisiomed ABA",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#1D1819" },
  ],
};

// Aplica o tema e as preferências de acessibilidade salvos antes da primeira
// pintura (evita a tela piscar no formato padrão e depois mudar).
const scriptTema = `try{var t=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema + SCRIPT_ACESSIBILIDADE }} />
      </head>
      <body className="sb-root">
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        {children}
        <Notificacoes />
        <VLibras />
      </body>
    </html>
  );
}
