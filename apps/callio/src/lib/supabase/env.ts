export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase pilote l'application des que les deux variables publiques existent. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Source de donnees effective.
 *
 * Choix explicite par CALLIO_DATA_SOURCE, sinon deduction : Supabase s'il est
 * configure, demonstration sinon. Demander Supabase sans l'avoir configure est
 * une erreur de configuration, pas un cas a rattraper silencieusement.
 */
export function resolveDataSource(): "demo" | "supabase" {
  const explicit = process.env.CALLIO_DATA_SOURCE?.trim().toLowerCase();

  if (explicit === "supabase") {
    if (!isSupabaseConfigured) {
      throw new Error(
        "CALLIO_DATA_SOURCE=supabase mais NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY sont absents.",
      );
    }
    return "supabase";
  }

  if (explicit === "demo") return "demo";
  if (explicit && explicit.length > 0) {
    throw new Error(
      `CALLIO_DATA_SOURCE invalide : "${explicit}". Valeurs acceptees : "demo", "supabase".`,
    );
  }

  return isSupabaseConfigured ? "supabase" : "demo";
}

/**
 * Garde-fou de production.
 *
 * Le mode demonstration contourne l'authentification : il n'a de sens qu'en
 * developpement. En production il est refuse, sauf autorisation explicite.
 */
export function isDemoAllowedHere(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.CALLIO_ALLOW_DEMO_IN_PRODUCTION === "1";
}
