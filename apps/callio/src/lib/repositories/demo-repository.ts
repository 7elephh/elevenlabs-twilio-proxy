import {
  DEMO_COMPANY_ID,
  demoAgentSettings,
  demoAppointments,
  demoCalls,
  demoCompany,
  demoConsents,
  demoIntegrations,
  demoLeads,
  demoMembers,
} from "@/lib/demo/climanova";
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
import type { CallioRepository } from "./types";

/**
 * Implementation sur fixtures.
 *
 * `source` vaut "demo" : l'interface s'en sert pour afficher un bandeau
 * permanent. Aucune donnee reelle ne transite ici, et aucune donnee de
 * demonstration ne peut atteindre le chemin Supabase.
 *
 * Le filtrage par `companyId` est applique malgre l'espace unique, pour que le
 * comportement soit identique a celui de l'implementation Supabase.
 */
export class DemoRepository implements CallioRepository {
  readonly source = "demo" as const;

  async listCompaniesForUser(_userId: string): Promise<Company[]> {
    return [demoCompany];
  }

  async getCompany(companyId: string): Promise<Company | null> {
    return companyId === DEMO_COMPANY_ID ? demoCompany : null;
  }

  async listMembers(companyId: string): Promise<CompanyMember[]> {
    return demoMembers.filter((m) => m.companyId === companyId);
  }

  async listLeads(companyId: string): Promise<Lead[]> {
    return demoLeads
      .filter((l) => l.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLead(companyId: string, leadId: string): Promise<LeadDetail | null> {
    const lead = demoLeads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) return null;

    return {
      ...lead,
      consent: demoConsents.find((c) => c.leadId === lead.id) ?? null,
      calls: demoCalls
        .filter((c) => c.leadId === lead.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      appointments: demoAppointments
        .filter((a) => a.leadId === lead.id)
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    };
  }

  async listCalls(companyId: string): Promise<Call[]> {
    return demoCalls
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async listAppointments(companyId: string): Promise<Appointment[]> {
    return demoAppointments
      .filter((a) => a.companyId === companyId)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }

  async getAgentSettings(companyId: string): Promise<AgentSettings | null> {
    return companyId === DEMO_COMPANY_ID ? demoAgentSettings : null;
  }

  async listIntegrations(companyId: string): Promise<Integration[]> {
    return demoIntegrations.filter((i) => i.companyId === companyId);
  }
}
