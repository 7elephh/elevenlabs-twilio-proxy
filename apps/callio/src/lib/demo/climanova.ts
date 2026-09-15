import type {
  AgentSettings,
  Appointment,
  Call,
  Company,
  CompanyMember,
  Integration,
  Lead,
  LeadConsent,
} from "@/lib/domain/types";

/**
 * Espace de demonstration ClimaNova.
 *
 * Donnees entierement fictives, isolees dans ce seul fichier et jamais
 * melangees a des donnees reelles : elles ne sont servies que par
 * DemoRepository, qui s'annonce comme tel (`source === "demo"`) et declenche
 * un bandeau permanent dans l'interface.
 *
 * Les dates sont relatives a l'instant de lecture pour que le tableau de bord
 * reste parlant quelle que soit la date d'execution.
 */

export const DEMO_COMPANY_ID = "demo-climanova";
export const DEMO_USER_ID = "demo-user-owner";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Instant fige au chargement du module, pour que toutes les dates soient coherentes. */
const NOW = Date.now();

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

function ahead(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

export const demoCompany: Company = {
  id: DEMO_COMPANY_ID,
  name: "ClimaNova",
  slug: "climanova",
  vertical: "hvac",
  status: "active",
  timezone: "Europe/Paris",
  createdAt: ago(180 * DAY),
};

export const demoMembers: CompanyMember[] = [
  {
    id: "demo-member-1",
    companyId: DEMO_COMPANY_ID,
    userId: DEMO_USER_ID,
    role: "owner",
    displayName: "Sofia Renard",
    email: "sofia@climanova.example",
    createdAt: ago(180 * DAY),
  },
  {
    id: "demo-member-2",
    companyId: DEMO_COMPANY_ID,
    userId: "demo-user-admin",
    role: "admin",
    displayName: "Marc Delaunay",
    email: "marc@climanova.example",
    createdAt: ago(120 * DAY),
  },
  {
    id: "demo-member-3",
    companyId: DEMO_COMPANY_ID,
    userId: "demo-user-tech",
    role: "member",
    displayName: "Yanis Berthier",
    email: "yanis@climanova.example",
    createdAt: ago(60 * DAY),
  },
];

export const demoLeads: Lead[] = [
  {
    id: "demo-lead-1",
    companyId: DEMO_COMPANY_ID,
    fullName: "Claire Fontaine",
    phone: "+33612480091",
    email: "claire.fontaine@example.com",
    postalCode: "34000",
    city: "Montpellier",
    requestType: "installation_pac",
    source: "quote_form",
    status: "appointment_set",
    urgency: "normal",
    nextAction: "Visite technique confirmée",
    nextActionAt: ahead(2 * DAY),
    notes: "Maison de 110 m², chauffage au fioul à remplacer.",
    createdAt: ago(3 * DAY),
    firstHandledAt: ago(3 * DAY - 11 * MINUTE),
  },
  {
    id: "demo-lead-2",
    companyId: DEMO_COMPANY_ID,
    fullName: "Bernard Alonzo",
    phone: "+33768112204",
    email: null,
    postalCode: "34070",
    city: "Montpellier",
    requestType: "repair",
    source: "missed_call",
    status: "transferred",
    urgency: "critical",
    nextAction: "Rappel technicien sous 1 h",
    nextActionAt: ahead(1 * HOUR),
    notes: "Panne totale de climatisation, commerce ouvert au public.",
    createdAt: ago(6 * HOUR),
    firstHandledAt: ago(6 * HOUR - 2 * MINUTE),
  },
  {
    id: "demo-lead-3",
    companyId: DEMO_COMPANY_ID,
    fullName: "Nadia Lemoine",
    phone: "+33684330157",
    email: "n.lemoine@example.com",
    postalCode: "34090",
    city: "Montpellier",
    requestType: "installation_clim",
    source: "quote_form",
    status: "qualified",
    urgency: "normal",
    nextAction: "Proposer trois créneaux",
    nextActionAt: ahead(4 * HOUR),
    notes: "Appartement 3 pièces, deux splits souhaités.",
    createdAt: ago(1 * DAY),
    firstHandledAt: ago(1 * DAY - 7 * MINUTE),
  },
  {
    id: "demo-lead-4",
    companyId: DEMO_COMPANY_ID,
    fullName: "Théo Vasseur",
    phone: "+33755090442",
    email: null,
    postalCode: "30900",
    city: "Nîmes",
    requestType: "installation_pac",
    source: "quote_form",
    status: "new",
    urgency: "normal",
    nextAction: "Premier appel de qualification",
    nextActionAt: ahead(30 * MINUTE),
    notes: null,
    createdAt: ago(45 * MINUTE),
    firstHandledAt: null,
  },
  {
    id: "demo-lead-5",
    companyId: DEMO_COMPANY_ID,
    fullName: "Hélène Brunet",
    phone: "+33629774510",
    email: "h.brunet@example.com",
    postalCode: "34000",
    city: "Montpellier",
    requestType: "maintenance",
    source: "quote_form",
    status: "contacting",
    urgency: "low",
    nextAction: "Deuxième tentative d'appel",
    nextActionAt: ahead(3 * HOUR),
    notes: "Entretien annuel de deux unités.",
    createdAt: ago(2 * DAY),
    firstHandledAt: ago(2 * DAY - 26 * MINUTE),
  },
  {
    id: "demo-lead-6",
    companyId: DEMO_COMPANY_ID,
    fullName: "Karim Ouazzani",
    phone: "+33771205583",
    email: null,
    postalCode: "34200",
    city: "Sète",
    requestType: "repair",
    source: "missed_call",
    status: "unreachable",
    urgency: "high",
    nextAction: "Dernière tentative avant clôture",
    nextActionAt: ahead(1 * DAY),
    notes: "Trois appels sans réponse.",
    createdAt: ago(5 * DAY),
    firstHandledAt: null,
  },
  {
    id: "demo-lead-7",
    companyId: DEMO_COMPANY_ID,
    fullName: "Paul Guérin",
    phone: "+33601445509",
    email: null,
    postalCode: "75011",
    city: "Paris",
    requestType: "installation_clim",
    source: "quote_form",
    status: "rejected",
    urgency: "normal",
    nextAction: null,
    nextActionAt: null,
    notes: "Hors zone d'intervention : transféré vers un partenaire.",
    createdAt: ago(8 * DAY),
    firstHandledAt: ago(8 * DAY - 4 * MINUTE),
  },
];

export const demoConsents: LeadConsent[] = demoLeads
  .filter((l) => l.source === "quote_form")
  .map((l, index) => ({
    id: `demo-consent-${index + 1}`,
    companyId: DEMO_COMPANY_ID,
    leadId: l.id,
    channel: "phone" as const,
    granted: true,
    statementShown:
      "J'accepte d'être recontacté par téléphone par ClimaNova au sujet de ma demande de devis.",
    evidenceSource: "https://climanova.example/devis",
    collectedAt: l.createdAt,
  }));

export const demoCalls: Call[] = [
  {
    id: "demo-call-1",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-1",
    direction: "outbound",
    startedAt: ago(3 * DAY - 11 * MINUTE),
    durationSeconds: 214,
    outcome: "appointment_set",
    urgency: "normal",
    summary:
      "Remplacement d'une chaudière fioul par une PAC air/eau. Maison de 110 m², isolation refaite en 2021. Visite technique fixée.",
    providerCallId: null,
  },
  {
    id: "demo-call-2",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-2",
    direction: "inbound",
    startedAt: ago(6 * HOUR - 2 * MINUTE),
    durationSeconds: 48,
    outcome: "transferred_to_human",
    urgency: "critical",
    summary:
      "Panne totale sur un commerce ouvert au public. Urgence critique : transfert immédiat vers l'astreinte.",
    providerCallId: null,
  },
  {
    id: "demo-call-3",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-3",
    direction: "outbound",
    startedAt: ago(1 * DAY - 7 * MINUTE),
    durationSeconds: 176,
    outcome: "qualified",
    urgency: "normal",
    summary:
      "Appartement 3 pièces, deux splits. Budget annoncé cohérent. Créneaux à proposer.",
    providerCallId: null,
  },
  {
    id: "demo-call-4",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-5",
    direction: "outbound",
    startedAt: ago(2 * DAY - 26 * MINUTE),
    durationSeconds: 31,
    outcome: "voicemail",
    urgency: "low",
    summary: "Messagerie. Message laissé, rappel programmé.",
    providerCallId: null,
  },
  {
    id: "demo-call-5",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-6",
    direction: "outbound",
    startedAt: ago(4 * DAY),
    durationSeconds: 0,
    outcome: "no_answer",
    urgency: "high",
    summary: null,
    providerCallId: null,
  },
  {
    id: "demo-call-6",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-7",
    direction: "outbound",
    startedAt: ago(8 * DAY - 4 * MINUTE),
    durationSeconds: 62,
    outcome: "rejected",
    urgency: "normal",
    summary: "Adresse hors zone d'intervention déclarée. Orientation vers un partenaire.",
    providerCallId: null,
  },
];

export const demoAppointments: Appointment[] = [
  {
    id: "demo-appt-1",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-1",
    service: "Visite technique — installation PAC",
    assigneeMemberId: "demo-member-3",
    assigneeName: "Yanis Berthier",
    scheduledAt: ahead(2 * DAY),
    durationMinutes: 90,
    status: "confirmed",
    externalEventId: null,
  },
  {
    id: "demo-appt-2",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-3",
    service: "Devis sur site — climatisation",
    assigneeMemberId: "demo-member-2",
    assigneeName: "Marc Delaunay",
    scheduledAt: ahead(5 * DAY),
    durationMinutes: 60,
    status: "proposed",
    externalEventId: null,
  },
  {
    id: "demo-appt-3",
    companyId: DEMO_COMPANY_ID,
    leadId: "demo-lead-5",
    service: "Entretien annuel",
    assigneeMemberId: "demo-member-3",
    assigneeName: "Yanis Berthier",
    scheduledAt: ago(6 * DAY),
    durationMinutes: 45,
    status: "completed",
    externalEventId: null,
  },
];

export const demoAgentSettings: AgentSettings = {
  companyId: DEMO_COMPANY_ID,
  enabled: true,
  agentDisplayName: "Léa — ClimaNova",
  services: [
    "Installation pompe à chaleur",
    "Installation climatisation",
    "Entretien annuel",
    "Dépannage",
  ],
  serviceAreaPostalCodes: ["34000", "34070", "34090", "34200", "30900"],
  businessHours: [
    { weekday: 1, opensAt: "08:30", closesAt: "18:00", closed: false },
    { weekday: 2, opensAt: "08:30", closesAt: "18:00", closed: false },
    { weekday: 3, opensAt: "08:30", closesAt: "18:00", closed: false },
    { weekday: 4, opensAt: "08:30", closesAt: "18:00", closed: false },
    { weekday: 5, opensAt: "08:30", closesAt: "17:00", closed: false },
    { weekday: 6, opensAt: "09:00", closesAt: "12:00", closed: false },
    { weekday: 0, opensAt: "00:00", closesAt: "00:00", closed: true },
  ],
  transferPhone: "+33467000000",
  transferOnUrgency: ["critical"],
  transferOutsideHours: true,
  qualificationQuestions: [
    {
      id: "q1",
      prompt: "S'agit-il d'une installation, d'un entretien ou d'un dépannage ?",
      answerKey: "request_type",
      required: true,
    },
    {
      id: "q2",
      prompt: "Quelle est la surface à traiter ?",
      answerKey: "surface_m2",
      required: true,
    },
    {
      id: "q3",
      prompt: "Êtes-vous propriétaire du logement ?",
      answerKey: "is_owner",
      required: true,
    },
    {
      id: "q4",
      prompt: "Dans quel délai souhaitez-vous intervenir ?",
      answerKey: "timeframe",
      required: false,
    },
  ],
  updatedAt: ago(4 * DAY),
};

export const demoIntegrations: Integration[] = [
  {
    id: "demo-int-voice",
    companyId: DEMO_COMPANY_ID,
    kind: "voice",
    provider: "vapi",
    status: "not_configured",
    statusMessage: null,
    connectedAt: null,
  },
  {
    id: "demo-int-calendar",
    companyId: DEMO_COMPANY_ID,
    kind: "calendar",
    provider: "google_calendar",
    status: "not_configured",
    statusMessage: null,
    connectedAt: null,
  },
  {
    id: "demo-int-sms",
    companyId: DEMO_COMPANY_ID,
    kind: "sms",
    provider: "undecided",
    status: "not_configured",
    statusMessage: "Fournisseur SMS non arrêté à ce stade du projet.",
    connectedAt: null,
  },
];
