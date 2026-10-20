import { z } from "zod";

/**
 * Normalise un numéro français ou international au format E.164.
 * Accepte : 06 12 34 56 78, 0612345678, +33 6 12 34 56 78, 0033612345678, +32…
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  let e164: string;
  if (/^0[1-9]\d{8}$/.test(cleaned)) e164 = `+33${cleaned.slice(1)}`;
  else if (/^00\d{8,15}$/.test(cleaned)) e164 = `+${cleaned.slice(2)}`;
  else if (/^\+\d{8,15}$/.test(cleaned)) e164 = cleaned;
  else return null;
  if (e164.startsWith("+33") && !/^\+33[1-9]\d{8}$/.test(e164)) return null;
  return e164;
}

export function formatPhoneDisplay(e164: string): string {
  if (/^\+33\d{9}$/.test(e164)) {
    const local = `0${e164.slice(3)}`;
    return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return e164;
}

const name = z
  .string()
  .trim()
  .min(1, "Champ requis")
  .max(60, "60 caractères maximum")
  .regex(/^[\p{L}][\p{L}\p{M}' .-]*$/u, "Caractères non autorisés");

export const bookingRequestSchema = z.object({
  serviceId: z.uuid("Prestation invalide"),
  startsAt: z.iso.datetime({ message: "Créneau invalide" }),
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" });
        return z.NEVER;
      }
      return p;
    }),
  email: z
    .union([z.literal(""), z.email("Adresse email invalide").max(254)])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
  note: z
    .string()
    .trim()
    .max(500, "500 caractères maximum")
    .optional()
    .transform((v) => v || null),
  privacyAccepted: z.literal(true, { message: "Coche la case pour confirmer avoir lu la politique de confidentialité" }),
  // Champ piège invisible : doit rester vide.
  website: z.string().max(0).optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Erreurs métier renvoyées par la base, traduites pour le client. */
export const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  slot_taken: "Ce créneau vient d'être pris. Choisis-en un autre.",
  slot_unavailable: "Ce créneau n'est plus disponible. Choisis-en un autre.",
  service_unavailable: "Cette prestation n'est pas disponible à la réservation en ligne.",
  booking_disabled: "La réservation en ligne est momentanément fermée.",
  too_many_bookings: "Tu as déjà des rendez-vous à venir. Contacte le salon pour en ajouter un.",
  rate_limited: "Trop de réservations depuis cette connexion. Réessaie plus tard ou contacte le salon.",
};
