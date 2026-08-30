"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-display italic text-3xl text-text mb-1">Livro</p>
        <p className="text-sm text-text-muted mb-8">
          O teu gestor de património e finanças pessoais.
        </p>

        {sent ? (
          <div className="rounded-lg border border-line bg-surface p-5 text-sm text-text-muted">
            Enviámos um link de acesso para <span className="text-text">{email}</span>. Abre o
            email e clica no link para entrares.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-[11px] uppercase tracking-[0.14em] text-text-faint">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@exemplo.com"
              className="rounded-md border border-line bg-surface-alt px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-md bg-gold px-3 py-2.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "A enviar..." : "Enviar link de acesso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
