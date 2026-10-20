import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Rafraîchit la session Supabase et protège l'espace /admin. */
export async function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname.startsWith("/admin/login");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLogin) {
    const url = new URL("/admin/login", request.url);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/api/google/:path*"] };
