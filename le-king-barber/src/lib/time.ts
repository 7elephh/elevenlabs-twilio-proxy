import { addDays, format, getISODay, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "Europe/Paris";

/** Convertit une heure murale locale ("2026-03-29", "09:30") en instant UTC. */
export function zonedWallTimeToUtc(date: string, time: string, timezone: string): Date {
  return fromZonedTime(`${date}T${time.slice(0, 5)}:00`, timezone);
}

/** Date locale (YYYY-MM-DD) d'un instant dans le fuseau du salon. */
export function localDateOf(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

export function localTimeOf(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "HH:mm");
}

export function addDaysToDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date calendaire. */
export function isoWeekday(date: string): number {
  return getISODay(parseISO(date));
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === value;
}

export function formatLongDate(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "EEEE d MMMM yyyy", { locale: fr });
}

export function formatDateLabel(date: string, pattern = "EEEE d MMMM"): string {
  return format(parseISO(date), pattern, { locale: fr });
}

export function formatDateTime(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr });
}

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
  }).format(euros);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function formatHour(time: string): string {
  const [h, m] = time.slice(0, 5).split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
