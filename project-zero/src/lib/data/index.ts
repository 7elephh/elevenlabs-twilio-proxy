import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerProfile } from "@/lib/domain/types";
import { LocalStore } from "./local-store";
import { SupabaseStore } from "./supabase-store";
import type { CurrentUser, DataStore } from "./store";

/**
 * Single-user today, multi-user by construction: the user id always comes from
 * the session (Supabase) or from the local single-player identity, never from a
 * literal sprinkled through the queries.
 */
export const LOCAL_USER: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: null,
};

export async function getStore(): Promise<DataStore> {
  if (!isSupabaseConfigured) return new LocalStore();
  return new SupabaseStore(await createSupabaseServerClient());
}

/** Resolved once per request. Null means "signed out" in Supabase mode. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured) return LOCAL_USER;
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

export const DEFAULT_PROFILE: Omit<PlayerProfile, "id" | "userId" | "createdAt"> = {
  displayName: "Player",
  primaryPosition: "RB",
  secondaryPositions: [],
  preferredRole: "GENERALIST",
  baselineDate: null,
  isDemo: false,
};

/** Profile of the signed-in user, falling back to defaults before first save. */
export async function getProfileOrDefault(
  store: DataStore,
  userId: string,
): Promise<PlayerProfile> {
  const profile = await store.getProfile(userId);
  if (profile) return profile;
  return {
    ...DEFAULT_PROFILE,
    id: userId,
    userId,
    createdAt: new Date().toISOString(),
  };
}

export type { DataStore, CurrentUser } from "./store";
