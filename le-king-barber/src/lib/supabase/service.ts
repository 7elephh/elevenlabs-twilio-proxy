import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

let cached: SupabaseClient | null = null;

/**
 * Client « service » : contourne la RLS. Uniquement côté serveur, pour le moteur
 * de réservation et les tâches planifiées, après validation des entrées.
 */
export function createServiceClient(): SupabaseClient {
  if (!SUPABASE_URL || !serverEnv.supabaseServiceRoleKey) {
    throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  cached ??= createClient(SUPABASE_URL, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const isServiceConfigured = () => Boolean(SUPABASE_URL && serverEnv.supabaseServiceRoleKey);
