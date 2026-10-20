import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Client lié à la session de l'utilisateur (RLS appliquée). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appel depuis un Server Component : le middleware rafraîchit la session.
        }
      },
    },
  });
}
