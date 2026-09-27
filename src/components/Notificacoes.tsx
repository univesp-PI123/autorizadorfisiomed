"use client";

import { Toaster } from "react-hot-toast";

// Avisos flutuantes no estilo Sóbrio: superfície de card, borda fina e
// sombra de popover (é algo que flutua).
export default function Notificacoes() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--surface-card)",
          color: "var(--ink)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-popover)",
          font: "400 13px/20px var(--font-sans)",
          padding: "10px 12px",
        },
        success: { iconTheme: { primary: "var(--success)", secondary: "var(--surface-card)" } },
        error: { iconTheme: { primary: "var(--danger-ink)", secondary: "var(--surface-card)" } },
      }}
    />
  );
}
