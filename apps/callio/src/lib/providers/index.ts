import type { UrgencyLevel } from "@/lib/domain/types";

/**
 * Contrats des integrations externes.
 *
 * Aucune implementation n'est fournie a ce stade : ces interfaces existent
 * pour que le code metier soit ecrit contre un contrat stable plutot que
 * contre un fournisseur. Vapi, Google Calendar et le fournisseur SMS
 * viendront s'y brancher sans toucher aux appelants.
 *
 * Regle : ces interfaces ne sont implementees que cote serveur. Aucune cle
 * de fournisseur ne doit traverser la frontiere du navigateur.
 */

export type PlaceCallInput = {
  companyId: string;
  leadId: string;
  toPhone: string;
  /** Rendu idempotent : rejouer la meme cle ne declenche pas un second appel. */
  idempotencyKey: string;
};

export type PlaceCallResult = {
  providerCallId: string;
  status: "queued" | "ringing" | "rejected";
};

export interface VoiceProvider {
  readonly name: string;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  transferCall(providerCallId: string, toPhone: string): Promise<void>;
}

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
};

export type BookInput = {
  companyId: string;
  leadId: string;
  slot: AvailabilitySlot;
  service: string;
  assigneeMemberId: string | null;
  idempotencyKey: string;
};

export interface CalendarProvider {
  readonly name: string;
  listAvailability(
    companyId: string,
    from: string,
    to: string,
  ): Promise<AvailabilitySlot[]>;
  book(input: BookInput): Promise<{ externalEventId: string }>;
  cancel(externalEventId: string): Promise<void>;
}

export type SendSmsInput = {
  companyId: string;
  toPhone: string;
  body: string;
  urgency: UrgencyLevel;
  idempotencyKey: string;
};

export interface SmsProvider {
  readonly name: string;
  send(input: SendSmsInput): Promise<{ providerMessageId: string }>;
}
