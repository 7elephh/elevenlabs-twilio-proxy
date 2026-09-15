import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Protection des routes /app/*.
 *
 * Convention `proxy` de Next 16 (ex-`middleware`), executee au bord avant
 * le rendu des Server Components.
 *
 * Deux roles :
 *   1. rafraichir la session Supabase a chaque requete, avant le rendu des
 *      Server Components — sans cela, un jeton expire ne serait jamais renouvele ;
 *   2. rediriger vers /login toute requete non authentifiee.
 *
 * Le proxy lit les variables directement depuis process.env : il s'execute
 * dans le runtime Edge, ou les modules serveur classiques ne sont pas charges.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const explicitSource = process.env.CALLIO_DATA_SOURCE?.trim().toLowerCase();
  const demoMode = explicitSource === "demo" || (!explicitSource && !(url && anonKey));

  if (demoMode) {
    // Le mode demonstration n'a pas de session a proteger. Il reste refuse en
    // production, sauf autorisation explicite : la verification est faite ici
    // pour que la reponse soit immediate plutot qu'une erreur de rendu.
    const allowed =
      process.env.NODE_ENV !== "production" ||
      process.env.CALLIO_ALLOW_DEMO_IN_PRODUCTION === "1";

    if (!allowed) {
      return new NextResponse(
        "Mode démonstration désactivé en production. Configurez Supabase pour utiliser /app.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    // Memorise la destination pour y revenir apres connexion.
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Ne couvre que l'application privee : la racine publique reste intacte.
  matcher: ["/app/:path*"],
};
