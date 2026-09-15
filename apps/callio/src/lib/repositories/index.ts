import { resolveDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DemoRepository } from "./demo-repository";
import { SupabaseRepository } from "./supabase-repository";
import type { CallioRepository } from "./types";

/**
 * Fabrique du depot, cote serveur uniquement.
 *
 * Le basculement vers Supabase se fait sans toucher a un seul composant :
 * il suffit de renseigner les variables d'environnement une fois les
 * migrations validees.
 */
export async function getRepository(): Promise<CallioRepository> {
  if (resolveDataSource() === "supabase") {
    return new SupabaseRepository(await createSupabaseServerClient());
  }
  return new DemoRepository();
}

export type { CallioRepository } from "./types";
