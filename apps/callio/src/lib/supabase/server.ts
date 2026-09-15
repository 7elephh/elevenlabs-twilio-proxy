import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Client Supabase lie a la requete courante.
 *
 * Il utilise la cle anon et la session de l'utilisateur : toutes les requetes
 * passent donc par la RLS. La cle service_role n'apparait nulle part dans
 * l'application — ni ici, ni a fortiori cote navigateur.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appele depuis un Server Component : l'ecriture de cookie y est
          // interdite. Le rafraichissement de session est assure par le
          // middleware, qui s'execute avant le rendu.
        }
      },
    },
  });
}
