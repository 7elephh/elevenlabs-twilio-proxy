import { addDaysToDate, isoWeekday, localDateOf, localTimeOf, zonedWallTimeToUtc } from "@/lib/time";

export interface OpeningRange {
  weekday: number; // 1 = lundi … 7 = dimanche
  opensAt: string; // "HH:MM" ou "HH:MM:SS", heure locale du salon
  closesAt: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface AvailabilityRules {
  timezone: string;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

export interface AvailabilityInput extends AvailabilityRules {
  now: Date;
  fromDate: string; // YYYY-MM-DD, inclus
  toDate: string; // YYYY-MM-DD, inclus
  durationMinutes: number;
  hours: OpeningRange[];
  /** Rendez-vous non annulés (la marge entre rendez-vous s'y applique). */
  bookings: Interval[];
  /** Congés, fermetures, blocages, occupations importées : bloquent tels quels. */
  blocked: Interval[];
}

export interface Slot {
  start: string; // ISO UTC
  label: string; // "HH:MM" heure locale
}

export interface DayAvailability {
  date: string;
  weekday: number;
  isOpen: boolean;
  slots: Slot[];
}

const MINUTE = 60_000;
const MAX_RANGE_DAYS = 62;

function overlaps(aStart: number, aEnd: number, b: Interval, padMs = 0): boolean {
  return aStart < b.end.getTime() + padMs && b.start.getTime() - padMs < aEnd;
}

/** Bornes de dates réservables, dans le fuseau du salon. */
export function bookableDateRange(now: Date, rules: Pick<AvailabilityRules, "timezone" | "maxAdvanceDays">) {
  const first = localDateOf(now, rules.timezone);
  return { first, last: addDaysToDate(first, rules.maxAdvanceDays) };
}

/**
 * Calcule les créneaux libres jour par jour.
 * Fonction pure : toutes les données (horaires, rendez-vous, blocages, heure courante)
 * sont fournies par l'appelant, ce qui la rend testable et réutilisable côté serveur
 * pour la vérification finale.
 */
export function computeAvailability(input: AvailabilityInput): DayAvailability[] {
  const { timezone } = input;
  if (input.durationMinutes <= 0 || input.slotIntervalMinutes <= 0) return [];

  const range = bookableDateRange(input.now, input);
  const from = input.fromDate < range.first ? range.first : input.fromDate;
  const to = input.toDate > range.last ? range.last : input.toDate;

  const earliest = input.now.getTime() + input.minNoticeMinutes * MINUTE;
  const durationMs = input.durationMinutes * MINUTE;
  const stepMs = input.slotIntervalMinutes * MINUTE;
  const bufferMs = input.bufferMinutes * MINUTE;

  const days: DayAvailability[] = [];
  for (let date = from, i = 0; date <= to && i < MAX_RANGE_DAYS; date = addDaysToDate(date, 1), i++) {
    const weekday = isoWeekday(date);
    const ranges = input.hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt));

    const slots: Slot[] = [];
    for (const r of ranges) {
      const open = zonedWallTimeToUtc(date, r.opensAt, timezone).getTime();
      const close = zonedWallTimeToUtc(date, r.closesAt, timezone).getTime();
      for (let start = open; start + durationMs <= close; start += stepMs) {
        const end = start + durationMs;
        if (start < earliest) continue;
        if (input.bookings.some((b) => overlaps(start, end, b, bufferMs))) continue;
        if (input.blocked.some((b) => overlaps(start, end, b))) continue;
        const instant = new Date(start);
        // Garde-fou : un créneau doit rester sur la même date locale (changement d'heure).
        if (localDateOf(instant, timezone) !== date) continue;
        slots.push({ start: instant.toISOString(), label: localTimeOf(instant, timezone) });
      }
    }
    days.push({ date, weekday, isOpen: ranges.length > 0, slots });
  }
  return days;
}

/** Vérifie qu'un instant précis fait partie des créneaux proposables. */
export function isSlotAvailable(input: Omit<AvailabilityInput, "fromDate" | "toDate">, startIso: string): boolean {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  const date = localDateOf(start, input.timezone);
  const [day] = computeAvailability({ ...input, fromDate: date, toDate: date });
  return Boolean(day?.slots.some((s) => s.start === start.toISOString()));
}
