import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso em Client Components ("use client").
 * Usa as chaves públicas (anon key) — seguro para expor no browser
 * porque toda a segurança de dados é garantida pelo Row Level Security (RLS).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
