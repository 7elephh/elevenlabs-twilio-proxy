import { z } from "zod";

/**
 * Schemas de validation des entrees.
 *
 * Ils sont partages entre le formulaire et le traitement serveur, de sorte
 * qu'une regle ne puisse pas diverger entre les deux cotes.
 */

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Adresse e-mail requise").email("Adresse e-mail invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/** Identifiant d'entreprise transmis par le selecteur. */
export const companySelectionSchema = z.object({
  companyId: z.string().trim().min(1),
});

/**
 * Charge utile d'un formulaire de devis entrant.
 *
 * Definie des maintenant pour que l'endpoint d'ingestion de la V1 soit ecrit
 * contre un contrat deja arrete. Le consentement est obligatoire et refuse
 * explicitement : sans preuve, pas de prospect appelable.
 */
export const quoteFormSchema = z.object({
  fullName: z.string().trim().min(1, "Nom requis").max(120),
  phone: z
    .string()
    .trim()
    .min(6, "Numéro de téléphone requis")
    .max(20)
    .regex(/^[+0-9 .()-]+$/, "Numéro de téléphone invalide"),
  email: z.string().trim().email("Adresse e-mail invalide").optional().nullable(),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal invalide").optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  requestType: z.enum([
    "installation_pac",
    "installation_clim",
    "maintenance",
    "repair",
    "other",
  ]),
  message: z.string().trim().max(2000).optional().nullable(),
  consentGranted: z.literal(true, {
    errorMap: () => ({ message: "Le consentement téléphonique est obligatoire" }),
  }),
  consentStatement: z.string().trim().min(1, "Texte de consentement manquant"),
  /** Cle de deduplication fournie par la source, pour l'idempotence. */
  externalRef: z.string().trim().max(200).optional().nullable(),
});

export type QuoteFormInput = z.infer<typeof quoteFormSchema>;
