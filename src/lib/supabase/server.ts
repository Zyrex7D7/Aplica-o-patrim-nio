import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Lê/escreve os cookies de sessão do Next.js para manter o
 * utilizador autenticado entre pedidos.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado: `setAll` foi chamado a partir de um Server Component.
            // Isto é seguro se tiveres middleware a refrescar as sessões.
          }
        },
      },
    }
  );
}
