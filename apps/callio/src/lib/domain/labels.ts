import type {
  AppointmentStatus,
  CallDirection,
  CallOutcome,
  IntegrationStatus,
  LeadSource,
  LeadStatus,
  RequestType,
  UrgencyLevel,
} from "./types";

/** Libelles d'interface, centralises pour rester coherents d'un ecran a l'autre. */

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacting: "Prise de contact",
  qualified: "Qualifié",
  appointment_set: "RDV pris",
  transferred: "Transféré",
  unreachable: "Injoignable",
  rejected: "Non retenu",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  quote_form: "Formulaire de devis",
  missed_call: "Appel manqué",
  manual: "Saisie manuelle",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  installation_pac: "Installation PAC",
  installation_clim: "Installation climatisation",
  maintenance: "Entretien",
  repair: "Dépannage",
  other: "Autre",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: "Faible",
  normal: "Normale",
  high: "Élevée",
  critical: "Critique",
};

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {
  inbound: "Entrant",
  outbound: "Sortant",
};

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  qualified: "Qualifié",
  appointment_set: "RDV pris",
  transferred_to_human: "Transféré",
  no_answer: "Sans réponse",
  voicemail: "Messagerie",
  rejected: "Non retenu",
  failed: "Échec technique",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  proposed: "Proposé",
  confirmed: "Confirmé",
  completed: "Réalisé",
  cancelled: "Annulé",
  no_show: "Absent",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: "Non configurée",
  connected: "Connectée",
  error: "En erreur",
};

/** Tonalite visuelle associee a un statut, consommee par le composant Badge. */
export type Tone = "neutral" | "accent" | "positive" | "warning" | "negative";

export const LEAD_STATUS_TONES: Record<LeadStatus, Tone> = {
  new: "accent",
  contacting: "warning",
  qualified: "positive",
  appointment_set: "positive",
  transferred: "neutral",
  unreachable: "negative",
  rejected: "negative",
};

export const CALL_OUTCOME_TONES: Record<CallOutcome, Tone> = {
  qualified: "positive",
  appointment_set: "positive",
  transferred_to_human: "neutral",
  no_answer: "warning",
  voicemail: "warning",
  rejected: "negative",
  failed: "negative",
};

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, Tone> = {
  proposed: "warning",
  confirmed: "positive",
  completed: "neutral",
  cancelled: "negative",
  no_show: "negative",
};

export const URGENCY_TONES: Record<UrgencyLevel, Tone> = {
  low: "neutral",
  normal: "neutral",
  high: "warning",
  critical: "negative",
};

export const INTEGRATION_STATUS_TONES: Record<IntegrationStatus, Tone> = {
  not_configured: "neutral",
  connected: "positive",
  error: "negative",
};
