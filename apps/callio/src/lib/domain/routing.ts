import type { AgentSettings, UrgencyLevel } from "./types";

/**
 * Regles de transfert vers un humain.
 *
 * Pure : cette fonction decide, elle n'appelle personne. Le declenchement reel
 * passera par un VoiceProvider (voir src/lib/providers), une fois l'integration
 * telephonique branchee.
 */

export type TransferDecision =
  | { transfer: false; reason: "agent_disabled" | "not_required" }
  | {
      transfer: true;
      reason: "urgency" | "outside_hours" | "out_of_service_area";
      /** Null quand la regle s'applique mais qu'aucun numero n'est configure. */
      toPhone: string | null;
    };

/** Convertit "HH:MM" en minutes depuis minuit. Null si la valeur est invalide. */
function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Indique si l'instant donne tombe dans les horaires d'ouverture.
 *
 * Un jour sans regle definie est considere comme ferme : en cas de
 * configuration incomplete, on transfere a un humain plutot que de laisser un
 * appel sans reponse.
 */
export function isWithinBusinessHours(settings: AgentSettings, at: Date): boolean {
  const rule = settings.businessHours.find((h) => h.weekday === at.getDay());
  if (!rule || rule.closed) return false;

  const opens = toMinutes(rule.opensAt);
  const closes = toMinutes(rule.closesAt);
  if (opens === null || closes === null || closes <= opens) return false;

  const current = at.getHours() * 60 + at.getMinutes();
  return current >= opens && current < closes;
}

export function isInServiceArea(
  settings: AgentSettings,
  postalCode: string | null,
): boolean {
  // Aucune zone declaree : l'entreprise n'a pas restreint son perimetre.
  if (settings.serviceAreaPostalCodes.length === 0) return true;
  if (!postalCode) return false;
  return settings.serviceAreaPostalCodes.includes(postalCode.trim());
}

export function decideTransfer(
  settings: AgentSettings,
  input: { urgency: UrgencyLevel; postalCode: string | null; at: Date },
): TransferDecision {
  if (!settings.enabled) return { transfer: false, reason: "agent_disabled" };

  const to = settings.transferPhone;

  if (settings.transferOnUrgency.includes(input.urgency)) {
    return { transfer: true, reason: "urgency", toPhone: to };
  }

  if (!isInServiceArea(settings, input.postalCode)) {
    return { transfer: true, reason: "out_of_service_area", toPhone: to };
  }

  if (settings.transferOutsideHours && !isWithinBusinessHours(settings, input.at)) {
    return { transfer: true, reason: "outside_hours", toPhone: to };
  }

  return { transfer: false, reason: "not_required" };
}

export const TRANSFER_REASON_LABELS: Record<
  Exclude<TransferDecision["reason"], "not_required" | "agent_disabled">,
  string
> = {
  urgency: "Urgence déclarée",
  outside_hours: "Hors horaires d'ouverture",
  out_of_service_area: "Hors zone d'intervention",
};
