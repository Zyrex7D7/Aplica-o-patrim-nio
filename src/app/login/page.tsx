"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou palavra-passe incorretos."
          : error.message
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-display italic text-3xl text-text mb-1">Livro</p>
        <p className="text-sm text-text-muted mb-8">
          O teu gestor de património e finanças pessoais.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-[11px] uppercase tracking-[0.14em] text-text-faint">Email</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@exemplo.com"
            className="rounded-md border border-line bg-surface-alt px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
          />

          <label className="text-[11px] uppercase tracking-[0.14em] text-text-faint mt-2">
            Palavra-passe
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-md border border-line bg-surface-alt px-3 py-2.5 text-sm text-text outline-none focus:border-gold"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-3 rounded-md bg-gold px-3 py-2.5 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-text-faint mt-6 leading-relaxed">
          Não há registo público. As contas são criadas pelo administrador com{" "}
          <code className="text-text-muted">npm run create-user</code>.
        </p>
      </div>
    </div>
  );
}
