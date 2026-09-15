import type {
  AgentSettings,
  Appointment,
  Call,
  Company,
  CompanyMember,
  Integration,
  Lead,
  LeadDetail,
} from "@/lib/domain/types";

/**
 * Frontiere d'acces aux donnees.
 *
 * Toute lecture metier passe par ici. Deux consequences voulues :
 *   * les composants ne connaissent ni Supabase ni les fixtures ;
 *   * `companyId` est un parametre obligatoire de chaque methode, ce qui rend
 *     impossible une requete metier sans portee d'entreprise.
 *
 * L'isolation reelle reste assuree par la RLS cote base : cette signature la
 * rend explicite dans le typage, elle ne la remplace pas.
 */
export interface CallioRepository {
  readonly source: "demo" | "supabase";

  /** Entreprises auxquelles l'utilisateur appartient, via company_members. */
  listCompaniesForUser(userId: string): Promise<Company[]>;
  getCompany(companyId: string): Promise<Company | null>;
  listMembers(companyId: string): Promise<CompanyMember[]>;

  listLeads(companyId: string): Promise<Lead[]>;
  getLead(companyId: string, leadId: string): Promise<LeadDetail | null>;

  listCalls(companyId: string): Promise<Call[]>;
  listAppointments(companyId: string): Promise<Appointment[]>;

  getAgentSettings(companyId: string): Promise<AgentSettings | null>;
  listIntegrations(companyId: string): Promise<Integration[]>;
}
