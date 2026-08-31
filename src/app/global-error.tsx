"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-PT">
      <body
        style={{
          background: "#0B0F14",
          color: "#EDEFF2",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Erro inesperado</p>
          <p style={{ fontSize: 14, color: "#8A93A3", marginBottom: 20, lineHeight: 1.5 }}>
            A aplicação encontrou um problema grave ao carregar. Recarrega a página; se persistir,
            os teus dados na Supabase continuam intactos.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#D9A441",
              color: "#0B0F14",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
