/**
 * Script de administração: cria um utilizador diretamente na Supabase,
 * sem enviar qualquer email de convite ou magic link.
 *
 * Usa a SERVICE ROLE KEY (nunca a anon key) — esta chave tem acesso total
 * à base de dados e contorna a Row Level Security, por isso só deve ser
 * usada aqui, em scripts do lado do servidor, e nunca no browser.
 *
 * Uso:
 *   npm run create-user -- --email tu@exemplo.com --password "umaPasswordForte123"
 *
 * (ou, sem npm): node --env-file=.env.local -e "..." — mas o script já lê
 * o .env.local sozinho via `tsx --env-file=.env.local`, configurado no
 * package.json.
 */
import { createClient } from "@supabase/supabase-js";

function parseArgs(): { email: string; password: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const email = get("--email");
  const password = get("--password");

  if (!email || !password) {
    console.error(
      "\nUso: npm run create-user -- --email tu@exemplo.com --password \"umaPasswordForte123\"\n"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("\nA palavra-passe deve ter pelo menos 8 caracteres.\n");
    process.exit(1);
  }

  return { email, password };
}

async function main() {
  const { email, password } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "\nFaltam variáveis de ambiente. Confirma que .env.local tem:\n" +
        "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=...\n" +
        "\n(a Service Role Key está em Project Settings -> API -> service_role, no dashboard Supabase)\n"
    );
    process.exit(1);
  }

  // Client "admin": usa a service role key, nunca exposta ao browser.
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // conta fica ativa de imediato, sem email de confirmação
  });

  if (error) {
    console.error(`\nErro ao criar utilizador: ${error.message}\n`);
    process.exit(1);
  }

  const userId = data.user!.id;

  // Cria as categorias por omissão para este utilizador.
  const { error: seedError } = await admin.rpc("seed_default_categories", {
    p_user_id: userId,
  });

  if (seedError) {
    console.warn(
      `\nUtilizador criado, mas falhou o seed de categorias por omissão: ${seedError.message}\n` +
        "Podes correr manualmente no SQL Editor: select public.seed_default_categories('" +
        userId +
        "');\n"
    );
  }

  console.log(`\n✓ Utilizador criado: ${email} (id: ${userId})`);
  console.log("  Já pode entrar em /login com o email e a palavra-passe indicados.\n");
}

main();
