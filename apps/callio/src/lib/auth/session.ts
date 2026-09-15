import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_COMPANY_ID, DEMO_USER_ID, demoMembers } from "@/lib/demo/climanova";
import type { Company, CompanyMember, CompanyRole } from "@/lib/domain/types";
import { getRepository } from "@/lib/repositories";
import type { CallioRepository } from "@/lib/repositories";
import { isDemoAllowedHere, resolveDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cookie portant l'entreprise selectionnee quand l'utilisateur en a plusieurs. */
export const ACTIVE_COMPANY_COOKIE = "callio_active_company";

export type SessionUser = {
  id: string;
  email: string | null;
};

export type AppSession = {
  user: SessionUser;
  /** Entreprise courante, resolue et verifiee. */
  company: Company;
  /** Role de l'utilisateur DANS cette entreprise, issu de company_members. */
  role: CompanyRole;
  /** Toutes les entreprises accessibles, pour le selecteur. */
  companies: Company[];
  repository: CallioRepository;
  source: "demo" | "supabase";
};

async function getSupabaseUser(): Promise<SessionUser | null> {
  const client = await createSupabaseServerClient();
  // getUser() revalide le jeton aupres de Supabase, contrairement a getSession()
  // qui se contente de lire le cookie : c'est la seule forme fiable cote serveur.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Resout la session applicative complete, ou redirige vers la connexion.
 *
 * Point important : l'entreprise active vient d'un cookie, mais elle est
 * toujours revalidee contre la liste des entreprises de l'utilisateur. Un
 * cookie forge ne donne donc acces a rien — au pire il est ignore.
 */
export async function requireSession(): Promise<AppSession> {
  const source = resolveDataSource();
  const repository = await getRepository();

  let user: SessionUser | null;

  if (source === "demo") {
    if (!isDemoAllowedHere()) {
      throw new Error(
        "Mode démonstration refusé en production. Configurer Supabase, ou définir CALLIO_ALLOW_DEMO_IN_PRODUCTION=1 en connaissance de cause.",
      );
    }
    user = { id: DEMO_USER_ID, email: "sofia@climanova.example" };
  } else {
    user = await getSupabaseUser();
  }

  if (!user) redirect("/login");

  const companies = await repository.listCompaniesForUser(user.id);
  if (companies.length === 0) redirect("/app/no-company");

  const requested = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  const company =
    companies.find((c) => c.id === requested) ?? (companies[0] as Company);

  const role = await resolveRole(repository, company.id, user.id, source);

  return { user, company, role, companies, repository, source };
}

/**
 * Role de l'utilisateur dans l'entreprise.
 *
 * Il provient exclusivement de `company_members`. Les metadonnees du compte
 * Supabase ne sont jamais consultees : elles sont modifiables et ne peuvent
 * pas faire autorite.
 */
async function resolveRole(
  repository: CallioRepository,
  companyId: string,
  userId: string,
  source: "demo" | "supabase",
): Promise<CompanyRole> {
  if (source === "demo") {
    const member = demoMembers.find(
      (m) => m.companyId === DEMO_COMPANY_ID && m.userId === userId,
    );
    return member?.role ?? "member";
  }

  const members: CompanyMember[] = await repository.listMembers(companyId);
  const member = members.find((m) => m.userId === userId);
  // Absence de ligne = aucun droit. On retombe sur le role le moins privilegie
  // plutot que d'inventer une appartenance ; la RLS bloquera de toute facon.
  return member?.role ?? "member";
}
