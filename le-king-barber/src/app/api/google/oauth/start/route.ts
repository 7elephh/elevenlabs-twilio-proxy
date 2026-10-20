import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/server-env";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/admin/integrations?google=non-configure", process.env.NEXT_PUBLIC_SITE_URL));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  // Protection CSRF : l'état doit revenir identique dans le callback.
  res.cookies.set("lkb_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
