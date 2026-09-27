import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SGA — Fisiomed ABA",
  description: "Sistema de Gestão de Autorizações da Fisiomed ABA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
