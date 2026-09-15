import type { Appointment, Call, Lead } from "./types";

/**
 * Calcul des indicateurs du tableau de bord.
 *
 * Module pur : il recoit des collections deja filtrees par entreprise et ne
 * fait aucun acces reseau. C'est la partie qui doit etre juste, donc c'est la
 * partie qui est testee.
 */

export type DashboardPeriod = {
  /** Borne basse incluse. */
  from: Date;
  /** Borne haute exclue. */
  to: Date;
};

export type DashboardMetrics = {
  newLeads: number;
  handledCalls: number;
  qualifiedLeads: number;
  appointmentsSet: number;
  transferredCalls: number;
  /**
   * Delai moyen de prise en charge, en minutes, entre la creation du prospect
   * et sa premiere prise en charge effective. Null tant qu'aucun prospect de
   * la periode n'a ete pris en charge — un zero serait un mensonge.
   */
  averageHandlingDelayMinutes: number | null;
  /** Nombre de prospects ayant reellement servi au calcul du delai moyen. */
  handlingDelaySampleSize: number;
};

function within(iso: string, period: DashboardPeriod): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= period.from.getTime() && t < period.to.getTime();
}

/** Periode glissante des `days` derniers jours, bornee a `now`. */
export function lastDays(days: number, now: Date = new Date()): DashboardPeriod {
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}

export function computeDashboardMetrics(
  leads: Lead[],
  calls: Call[],
  appointments: Appointment[],
  period: DashboardPeriod,
): DashboardMetrics {
  const periodLeads = leads.filter((l) => within(l.createdAt, period));
  const periodCalls = calls.filter((c) => within(c.startedAt, period));

  // Un appel est "traite" des lors qu'il a abouti a une decision ; un echec
  // technique ne compte pas comme une prise en charge.
  const handledCalls = periodCalls.filter((c) => c.outcome !== "failed").length;

  const transferredCalls = periodCalls.filter(
    (c) => c.outcome === "transferred_to_human",
  ).length;

  const qualifiedLeads = periodLeads.filter((l) =>
    l.status === "qualified" || l.status === "appointment_set",
  ).length;

  const appointmentsSet = appointments.filter(
    (a) => within(a.scheduledAt, period) && a.status !== "cancelled",
  ).length;

  const delays = periodLeads
    .filter((l) => l.firstHandledAt !== null)
    .map((l) => {
      const created = new Date(l.createdAt).getTime();
      const handled = new Date(l.firstHandledAt as string).getTime();
      return (handled - created) / 60_000;
    })
    // Une prise en charge anterieure a la creation traduit une donnee
    // incoherente : elle est ecartee plutot que de fausser la moyenne.
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);

  const averageHandlingDelayMinutes =
    delays.length === 0
      ? null
      : delays.reduce((sum, d) => sum + d, 0) / delays.length;

  return {
    newLeads: periodLeads.length,
    handledCalls,
    qualifiedLeads,
    appointmentsSet,
    transferredCalls,
    averageHandlingDelayMinutes,
    handlingDelaySampleSize: delays.length,
  };
}

export type ActivityItem = {
  id: string;
  at: string;
  kind: "lead" | "call" | "appointment";
  title: string;
  detail: string;
};

/** Flux d'activite recente, toutes natures confondues, du plus recent au plus ancien. */
export function buildRecentActivity(
  leads: Lead[],
  calls: Call[],
  appointments: Appointment[],
  limit = 8,
): ActivityItem[] {
  const leadName = new Map(leads.map((l) => [l.id, l.fullName]));

  const items: ActivityItem[] = [
    ...leads.map((l) => ({
      id: `lead-${l.id}`,
      at: l.createdAt,
      kind: "lead" as const,
      title: `Nouveau prospect — ${l.fullName}`,
      detail: l.city ? `${l.city}` : "Origine non précisée",
    })),
    ...calls.map((c) => ({
      id: `call-${c.id}`,
      at: c.startedAt,
      kind: "call" as const,
      title: `Appel ${c.direction === "inbound" ? "entrant" : "sortant"}`,
      detail: c.leadId ? (leadName.get(c.leadId) ?? "Prospect inconnu") : "Sans prospect rattaché",
    })),
    ...appointments.map((a) => ({
      id: `appt-${a.id}`,
      at: a.scheduledAt,
      kind: "appointment" as const,
      title: `Rendez-vous — ${a.service}`,
      detail: leadName.get(a.leadId) ?? "Prospect inconnu",
    })),
  ];

  return items
    .filter((i) => !Number.isNaN(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** Mise en forme d'une duree en minutes pour l'affichage. */
export function formatDelay(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}
