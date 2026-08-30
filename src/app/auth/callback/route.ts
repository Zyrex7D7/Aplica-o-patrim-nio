import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data?.user) {
      // Garante categorias por omissão na primeira vez que o utilizador entra.
      await supabase.rpc("seed_default_categories", { p_user_id: data.user.id });
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
