import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { completeGoogleConnection } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user } = await requireAdmin();
  const params = request.nextUrl.searchParams;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/admin/integrations?google=${status}`, SITE_URL));
    res.cookies.delete({ name: "lkb_google_state", path: "/api/google" });
    return res;
  };
  const expected = request.cookies.get("lkb_google_state")?.value;
  if (!expected || params.get("state") !== expected) return back("etat-invalide");
  if (params.get("error")) return back("refuse");
  const code = params.get("code");
  if (!code) return back("erreur");
  try {
    await completeGoogleConnection(code, user.id);
    return back("connecte");
  } catch (e) {
    console.error("Google OAuth", e);
    return back("erreur");
  }
}
