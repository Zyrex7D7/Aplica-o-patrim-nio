/**
 * Lista os utilizadores existentes na Supabase (id, email, data de criação).
 * Uso: npm run list-users
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "\nFaltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local\n"
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    console.error(`\nErro ao listar utilizadores: ${error.message}\n`);
    process.exit(1);
  }

  if (data.users.length === 0) {
    console.log("\nAinda não existem utilizadores. Cria um com `npm run create-user`.\n");
    return;
  }

  console.log("");
  for (const u of data.users) {
    console.log(`${u.email}   (id: ${u.id})   criado em ${new Date(u.created_at).toLocaleString("pt-PT")}`);
  }
  console.log("");
}

main();
