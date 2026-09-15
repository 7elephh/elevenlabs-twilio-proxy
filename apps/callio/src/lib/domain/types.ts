/**
 * Types centralises de la plateforme Callio.
 *
 * Regle structurante : toute donnee metier appartient a une entreprise via
 * `companyId`. Aucun type metier ne peut exister sans ce rattachement.
 */

// ---------------------------------------------------------------------------
// Entreprises et membres
// ---------------------------------------------------------------------------

/** Roles applicatifs. L'ordre traduit le niveau de privilege croissant. */
export const COMPANY_ROLES = ["member", "admin", "owner"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export type CompanyStatus = "active" | "suspended";

export type Company = {
  id: string;
  name: string;
  slug: string;
  /** Verticale metier. Une seule valeur en V2, ouverte pour la suite. */
  vertical: "hvac";
  status: CompanyStatus;
  timezone: string;
  createdAt: string;
};

export type CompanyMember = {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
  displayName: string;
  email: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export const LEAD_SOURCES = ["quote_form", "missed_call", "manual"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacting",
  "qualified",
  "appointment_set",
  "transferred",
  "unreachable",
  "rejected",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const REQUEST_TYPES = [
  "installation_pac",
  "installation_clim",
  "maintenance",
  "repair",
  "other",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const URGENCY_LEVELS = ["low", "normal", "high", "critical"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/**
 * Preuve de consentement telephonique.
 *
 * Conservee separement du prospect et jamais modifiee apres creation :
 * c'est une piece justificative, pas un champ de profil.
 */
export type LeadConsent = {
  id: string;
  companyId: string;
  leadId: string;
  channel: "phone" | "sms" | "email";
  granted: boolean;
  /** Texte exact affiche a la personne au moment du recueil. */
  statementShown: string;
  /** Origine technique du recueil (URL du formulaire, identifiant d'appel). */
  evidenceSource: string;
  collectedAt: string;
};

export type Lead = {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  email: string | null;
  postalCode: string | null;
  city: string | null;
  requestType: RequestType;
  source: LeadSource;
  status: LeadStatus;
  urgency: UrgencyLevel;
  /** Prochaine action prevue, rendue telle quelle dans la liste. */
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  createdAt: string;
  /** Premiere prise en charge effective (premier appel aboutissant). */
  firstHandledAt: string | null;
};

/** Prospect enrichi de ses elements lies, pour la fiche detaillee. */
export type LeadDetail = Lead & {
  consent: LeadConsent | null;
  calls: Call[];
  appointments: Appointment[];
};

// ---------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------

export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_OUTCOMES = [
  "qualified",
  "appointment_set",
  "transferred_to_human",
  "no_answer",
  "voicemail",
  "rejected",
  "failed",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type Call = {
  id: string;
  companyId: string;
  leadId: string | null;
  direction: CallDirection;
  startedAt: string;
  durationSeconds: number;
  outcome: CallOutcome;
  urgency: UrgencyLevel;
  summary: string | null;
  /** Identifiant chez le fournisseur de voix, pour la reconciliation. */
  providerCallId: string | null;
};

// ---------------------------------------------------------------------------
// Rendez-vous
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUSES = [
  "proposed",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type Appointment = {
  id: string;
  companyId: string;
  leadId: string;
  /** Prestation demandee, libellee par l'entreprise. */
  service: string;
  /** Membre affecte. Null tant que l'affectation n'est pas faite. */
  assigneeMemberId: string | null;
  assigneeName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  /** Identifiant de l'evenement chez le fournisseur d'agenda. */
  externalEventId: string | null;
};

// ---------------------------------------------------------------------------
// Configuration de l'agent
// ---------------------------------------------------------------------------

export type BusinessHours = {
  /** 0 = dimanche, conforme a Date.getDay(). */
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type QualificationQuestion = {
  id: string;
  prompt: string;
  /** Cle sous laquelle la reponse est stockee dans le resultat structure. */
  answerKey: string;
  required: boolean;
};

export type AgentSettings = {
  companyId: string;
  /** Interrupteur maitre : coupe toute prise en charge automatique. */
  enabled: boolean;
  agentDisplayName: string;
  services: string[];
  /** Codes postaux couverts. */
  serviceAreaPostalCodes: string[];
  businessHours: BusinessHours[];
  /** Numero vers lequel un appel est bascule sur un humain. */
  transferPhone: string | null;
  /** Niveaux declenchant un transfert immediat. */
  transferOnUrgency: UrgencyLevel[];
  /** Transfert systematique hors des horaires d'ouverture. */
  transferOutsideHours: boolean;
  qualificationQuestions: QualificationQuestion[];
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const INTEGRATION_KINDS = ["voice", "calendar", "sms"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const INTEGRATION_STATUSES = [
  "not_configured",
  "connected",
  "error",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/**
 * Etat d'une integration tel qu'il est expose a l'interface.
 *
 * Aucun secret n'apparait ici : les identifiants vivent cote serveur et ne
 * traversent jamais la frontiere du navigateur.
 */
export type Integration = {
  id: string;
  companyId: string;
  kind: IntegrationKind;
  /** Identifiant du fournisseur, ex. "vapi", "google_calendar". */
  provider: string;
  status: IntegrationStatus;
  /** Message lisible quand le statut vaut "error". */
  statusMessage: string | null;
  connectedAt: string | null;
};
