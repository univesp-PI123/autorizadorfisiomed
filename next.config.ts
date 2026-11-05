import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não revela "X-Powered-By: Next.js" nas respostas.
  poweredByHeader: false,
  // Não gera AGENTS.md / CLAUDE.md na raiz ao rodar "next dev".
  agentRules: false,
  // O validador de XML (TISS) abre um worker a partir da própria pasta em
  // node_modules: não pode ser empacotado.
  serverExternalPackages: ["xmllint-wasm"],
  // Telas que mudaram (03/11/2026): Agenda virou Solicitações e Atendimentos saiu.
  async redirects() {
    return [
      { source: "/agenda", destination: "/solicitacoes", permanent: false },
      { source: "/atendimentos", destination: "/solicitacoes", permanent: false },
    ];
  },
  // Cabeçalhos de segurança básicos (no sistema antigo, papel do helmet).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
