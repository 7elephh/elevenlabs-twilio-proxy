import { z } from "zod";

import {
  MEASUREMENT_METHODS,
  POSITIONS,
  RELIABILITY_LEVELS,
  ROLES,
  SESSION_TYPES,
  CHECKPOINT_KINDS,
} from "@/lib/domain/types";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format");

/** Quick session entry — five fields, three of them optional. */
export const sessionSchema = z.object({
  date: isoDate,
  sessionType: z.enum(SESSION_TYPES),
  durationMinutes: z.coerce
    .number()
    .int("Whole minutes only")
    .min(5, "At least 5 minutes")
    .max(600, "At most 600 minutes"),
  position: z.enum(POSITIONS).nullable().optional(),
  rpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type SessionFormValues = z.input<typeof sessionSchema>;

export const profileSchema = z.object({
  displayName: z.string().min(1, "Required").max(60),
  primaryPosition: z.enum(POSITIONS),
  secondaryPositions: z.array(z.enum(POSITIONS)).max(4),
  preferredRole: z.enum(ROLES),
});

export const testResultSchema = z.object({
  protocolSlug: z.string().min(1),
  performedAt: isoDate,
  attempts: z.array(z.coerce.number()).max(10),
  extras: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  measurementMethod: z.enum(MEASUREMENT_METHODS),
  reliabilityLevel: z.enum(RELIABILITY_LEVELS),
  conditions: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const checkpointSchema = z.object({
  date: isoDate,
  kind: z.enum(CHECKPOINT_KINDS),
  notes: z.string().max(500).nullable().optional(),
});
