import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AgentSettings,
  Appointment,
  BusinessHours,
  Call,
  Company,
  CompanyMember,
  Integration,
  Lead,
  LeadConsent,
  LeadDetail,
  QualificationQuestion,
  UrgencyLevel,
} from "@/lib/domain/types";
import type { CallioRepository } from "./types";

/**
 * Implementation Supabase.
 *
 * Toutes les requetes portent un filtre explicite sur `company_id`, en plus de
 * la RLS. La RLS reste la garantie : ce filtre applicatif est une seconde
 * barriere, utile si une policy venait a etre relachee par erreur.
 *
 * Le mapping snake_case -> camelCase est isole ici : aucune forme de ligne SQL
 * ne fuit vers le domaine ou vers les composants.
 */

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Lit un tableau JSONB en ecartant les elements du mauvais type. */
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function urgencyArray(value: unknown): UrgencyLevel[] {
  const allowed: UrgencyLevel[] = ["low", "normal", "high", "critical"];
  return stringArray(value).filter((v): v is UrgencyLevel =>
    (allowed as string[]).includes(v),
  );
}

function businessHours(value: unknown): BusinessHours[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): BusinessHours[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Row;
    const weekday = num(e.weekday, -1);
    if (weekday < 0 || weekday > 6) return [];
    return [
      {
        weekday,
        opensAt: str(e.opensAt ?? e.opens_at, "00:00"),
        closesAt: str(e.closesAt ?? e.closes_at, "00:00"),
        closed: bool(e.closed, true),
      },
    ];
  });
}

function qualificationQuestions(value: unknown): QualificationQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): QualificationQuestion[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Row;
    const id = str(e.id);
    if (!id) return [];
    return [
      {
        id,
        prompt: str(e.prompt),
        answerKey: str(e.answerKey ?? e.answer_key),
        required: bool(e.required),
      },
    ];
  });
}

function toCompany(row: Row): Company {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    vertical: "hvac",
    status: row.status === "suspended" ? "suspended" : "active",
    timezone: str(row.timezone, "Europe/Paris"),
    createdAt: str(row.created_at),
  };
}

function toMember(row: Row): CompanyMember {
  const role = str(row.role, "member");
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    userId: str(row.user_id),
    role: role === "owner" || role === "admin" ? role : "member",
    displayName: str(row.display_name),
    email: str(row.email),
    createdAt: str(row.created_at),
  };
}

function toLead(row: Row): Lead {
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    fullName: str(row.full_name),
    phone: str(row.phone),
    email: strOrNull(row.email),
    postalCode: strOrNull(row.postal_code),
    city: strOrNull(row.city),
    requestType: str(row.request_type, "other") as Lead["requestType"],
    source: str(row.source, "manual") as Lead["source"],
    status: str(row.status, "new") as Lead["status"],
    urgency: str(row.urgency, "normal") as Lead["urgency"],
    nextAction: strOrNull(row.next_action),
    nextActionAt: strOrNull(row.next_action_at),
    notes: strOrNull(row.notes),
    createdAt: str(row.created_at),
    firstHandledAt: strOrNull(row.first_handled_at),
  };
}

function toConsent(row: Row): LeadConsent {
  const channel = str(row.channel, "phone");
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    leadId: str(row.lead_id),
    channel: channel === "sms" || channel === "email" ? channel : "phone",
    granted: bool(row.granted),
    statementShown: str(row.statement_shown),
    evidenceSource: str(row.evidence_source),
    collectedAt: str(row.collected_at),
  };
}

function toCall(row: Row): Call {
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    leadId: strOrNull(row.lead_id),
    direction: row.direction === "inbound" ? "inbound" : "outbound",
    startedAt: str(row.started_at),
    durationSeconds: num(row.duration_seconds),
    outcome: str(row.outcome, "failed") as Call["outcome"],
    urgency: str(row.urgency, "normal") as Call["urgency"],
    summary: strOrNull(row.summary),
    providerCallId: strOrNull(row.provider_call_id),
  };
}

function toAppointment(row: Row): Appointment {
  // `company_members` est joint pour afficher un nom plutot qu'un identifiant.
  const assignee = row.assignee as Row | null | undefined;
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    leadId: str(row.lead_id),
    service: str(row.service),
    assigneeMemberId: strOrNull(row.assignee_member_id),
    assigneeName: assignee ? strOrNull(assignee.display_name) : null,
    scheduledAt: str(row.scheduled_at),
    durationMinutes: num(row.duration_minutes, 60),
    status: str(row.status, "proposed") as Appointment["status"],
    externalEventId: strOrNull(row.external_event_id),
  };
}

function toAgentSettings(row: Row): AgentSettings {
  return {
    companyId: str(row.company_id),
    enabled: bool(row.enabled),
    agentDisplayName: str(row.agent_display_name, "Callio"),
    services: stringArray(row.services),
    serviceAreaPostalCodes: stringArray(row.service_area_postal_codes),
    businessHours: businessHours(row.business_hours),
    transferPhone: strOrNull(row.transfer_phone),
    transferOnUrgency: urgencyArray(row.transfer_on_urgency),
    transferOutsideHours: bool(row.transfer_outside_hours, true),
    qualificationQuestions: qualificationQuestions(row.qualification_questions),
    updatedAt: str(row.updated_at),
  };
}

function toIntegration(row: Row): Integration {
  const status = str(row.status, "not_configured");
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    kind: str(row.kind, "voice") as Integration["kind"],
    provider: str(row.provider),
    status:
      status === "connected" || status === "error" ? status : "not_configured",
    statusMessage: strOrNull(row.status_message),
    connectedAt: strOrNull(row.connected_at),
  };
}

/** Remonte l'erreur PostgREST telle quelle : la masquer rendrait le debogage aveugle. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Réponse Supabase vide");
  return result.data;
}

export class SupabaseRepository implements CallioRepository {
  readonly source = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  async listCompaniesForUser(userId: string): Promise<Company[]> {
    // La RLS limite deja aux entreprises de l'utilisateur ; le filtre explicite
    // sur user_id garde la requete lisible et la double d'une seconde barriere.
    const rows = unwrap(
      await this.client
        .from("company_members")
        .select("companies(*)")
        .eq("user_id", userId),
    ) as Row[];

    return rows
      .map((r) => r.companies)
      .filter((c): c is Row => typeof c === "object" && c !== null)
      .map(toCompany);
  }

  async getCompany(companyId: string): Promise<Company | null> {
    const { data, error } = await this.client
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toCompany(data as Row) : null;
  }

  async listMembers(companyId: string): Promise<CompanyMember[]> {
    const rows = unwrap(
      await this.client
        .from("company_members")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true }),
    ) as Row[];
    return rows.map(toMember);
  }

  async listLeads(companyId: string): Promise<Lead[]> {
    const rows = unwrap(
      await this.client
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ) as Row[];
    return rows.map(toLead);
  }

  async getLead(companyId: string, leadId: string): Promise<LeadDetail | null> {
    const { data, error } = await this.client
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const [consentRows, callRows, apptRows] = await Promise.all([
      this.client
        .from("lead_consents")
        .select("*")
        .eq("company_id", companyId)
        .eq("lead_id", leadId)
        .order("collected_at", { ascending: false })
        .limit(1),
      this.client
        .from("calls")
        .select("*")
        .eq("company_id", companyId)
        .eq("lead_id", leadId)
        .order("started_at", { ascending: false }),
      this.client
        .from("appointments")
        .select("*, assignee:company_members!appointments_assignee_member_id_fkey(display_name)")
        .eq("company_id", companyId)
        .eq("lead_id", leadId)
        .order("scheduled_at", { ascending: false }),
    ]);

    for (const r of [consentRows, callRows, apptRows]) {
      if (r.error) throw new Error(r.error.message);
    }

    const firstConsent = (consentRows.data as Row[] | null)?.[0];

    return {
      ...toLead(data as Row),
      consent: firstConsent ? toConsent(firstConsent) : null,
      calls: ((callRows.data ?? []) as Row[]).map(toCall),
      appointments: ((apptRows.data ?? []) as Row[]).map(toAppointment),
    };
  }

  async listCalls(companyId: string): Promise<Call[]> {
    const rows = unwrap(
      await this.client
        .from("calls")
        .select("*")
        .eq("company_id", companyId)
        .order("started_at", { ascending: false }),
    ) as Row[];
    return rows.map(toCall);
  }

  async listAppointments(companyId: string): Promise<Appointment[]> {
    const rows = unwrap(
      await this.client
        .from("appointments")
        .select("*, assignee:company_members!appointments_assignee_member_id_fkey(display_name)")
        .eq("company_id", companyId)
        .order("scheduled_at", { ascending: false }),
    ) as Row[];
    return rows.map(toAppointment);
  }

  async getAgentSettings(companyId: string): Promise<AgentSettings | null> {
    const { data, error } = await this.client
      .from("agent_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toAgentSettings(data as Row) : null;
  }

  async listIntegrations(companyId: string): Promise<Integration[]> {
    const rows = unwrap(
      await this.client
        .from("integrations")
        .select("*")
        .eq("company_id", companyId)
        .order("kind", { ascending: true }),
    ) as Row[];
    return rows.map(toIntegration);
  }
}
