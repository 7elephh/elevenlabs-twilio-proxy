import { createClient } from "@supabase/supabase-js";

import { LocalStore } from "./local-store";
import { SupabaseStore } from "./supabase-store";
import type { DataStore } from "./store";

/**
 * Store factory for scripts (seed, maintenance) — no request context, so it
 * never touches next/headers. Uses the service role key when available.
 */
export function createAdminStore(): { store: DataStore; userId: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const seedUserId = process.env.SEED_USER_ID;

  if (url && serviceKey) {
    if (!seedUserId) {
      throw new Error(
        "SEED_USER_ID is required when seeding Supabase: set it to the auth user id to own the demo rows.",
      );
    }
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { store: new SupabaseStore(client), userId: seedUserId };
  }

  return {
    store: new LocalStore(),
    userId: seedUserId ?? "00000000-0000-4000-8000-000000000001",
  };
}
