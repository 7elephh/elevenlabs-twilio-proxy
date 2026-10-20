import "server-only";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Garantit que l'utilisateur est connecté ET enregistré dans admin_users.
 * À appeler en tête de chaque page et action de l'espace administrateur.
 */
export async function requireAdmin() {
  if (!isSupabaseConfigured) redirect("/admin/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/admin/login?erreur=acces");
  return { supabase, user };
}

export type ActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;
