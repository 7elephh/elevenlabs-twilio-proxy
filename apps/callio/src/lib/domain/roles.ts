import { COMPANY_ROLES, type CompanyRole } from "./types";

/**
 * Autorisations applicatives.
 *
 * Point non negociable : le role provient TOUJOURS de la table
 * `company_members`, jamais des metadonnees de l'utilisateur Supabase
 * (`user_metadata`, `app_metadata`) — celles-ci sont modifiables par le client
 * ou par un jeton, donc inutilisables comme source d'autorite.
 *
 * Ce module est pur : il ne lit rien, il decide a partir d'un role deja
 * resolu cote base sous RLS.
 */

/** Niveau de privilege, croissant. */
export function roleRank(role: CompanyRole): number {
  return COMPANY_ROLES.indexOf(role);
}

export function hasAtLeast(role: CompanyRole, minimum: CompanyRole): boolean {
  return roleRank(role) >= roleRank(minimum);
}

export const PERMISSIONS = [
  "leads.read",
  "leads.write",
  "calls.read",
  "appointments.read",
  "appointments.write",
  "settings.read",
  "settings.write",
  "team.read",
  "team.manage",
  "company.suspend",
  "billing.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MINIMUM_ROLE: Record<Permission, CompanyRole> = {
  "leads.read": "member",
  "leads.write": "member",
  "calls.read": "member",
  "appointments.read": "member",
  "appointments.write": "member",
  "settings.read": "member",
  "settings.write": "admin",
  "team.read": "member",
  "team.manage": "admin",
  "company.suspend": "owner",
  "billing.manage": "owner",
};

export function can(role: CompanyRole, permission: Permission): boolean {
  return hasAtLeast(role, MINIMUM_ROLE[permission]);
}

/** Libelles d'interface. */
export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};
