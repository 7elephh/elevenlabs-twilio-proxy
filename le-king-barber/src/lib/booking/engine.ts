import "server-only";

import {
  computeAvailability,
  isSlotAvailable,
  type AvailabilityRules,
  type DayAvailability,
  type Interval,
  type OpeningRange,
} from "@/lib/booking/availability";
import { fetchGoogleBusy } from "@/lib/google/calendar";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import { addDaysToDate, zonedWallTimeToUtc } from "@/lib/time";
import { hashIp, hashToken, manageTokenFor } from "@/lib/tokens";
import type { Booking, BusinessSettings, Service } from "@/lib/types";
import { BOOKING_ERROR_MESSAGES, type BookingRequest } from "@/lib/validation";

export class BookingError extends Error {
  constructor(
    public code: string,
    message = BOOKING_ERROR_MESSAGES[code] ?? "Une erreur est survenue. Merci de réessayer.",
    public status = 409,
  ) {
    super(message);
  }
}

export interface BookingContext {
  settings: BusinessSettings;
  rules: AvailabilityRules;
  hours: OpeningRange[];
}

export async function loadBookingContext(): Promise<BookingContext> {
  const supabase = createServiceClient();
  const [settings, hours] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("business_hours").select("weekday, opens_at, closes_at"),
  ]);
  if (settings.error || !settings.data) throw new BookingError("config", "Réglages du salon introuvables.", 500);
  const s = settings.data as BusinessSettings;
  return {
    settings: s,
    rules: {
      timezone: s.timezone,
      slotIntervalMinutes: s.slot_interval_minutes,
      bufferMinutes: s.buffer_minutes,
      minNoticeMinutes: s.min_notice_minutes,
      maxAdvanceDays: s.max_advance_days,
    },
    hours: (hours.data ?? []).map((h) => ({ weekday: h.weekday, opensAt: h.opens_at, closesAt: h.closes_at })),
  };
}

/** Occupations (rendez-vous non annulés, blocages, Google) sur une période. */
export async function loadBusy(from: Date, to: Date, timezone: string, excludeBookingId?: string) {
  const supabase = createServiceClient();
  let bookingsQuery = supabase
    .from("bookings")
    .select("id, starts_at, ends_at")
    .neq("status", "cancelled")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq("id", excludeBookingId);
  const [bookings, blocked, google] = await Promise.all([
    bookingsQuery,
    supabase.from("blocked_periods").select("starts_at, ends_at").lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()),
    fetchGoogleBusy(from, to, timezone),
  ]);
  if (bookings.error || blocked.error) throw new BookingError("db", "Impossible de lire l'agenda.", 500);
  const toInterval = (r: { starts_at: string; ends_at: string }): Interval => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) });
  return {
    bookings: bookings.data.map(toInterval),
    blocked: [...blocked.data.map(toInterval), ...google],
  };
}

export async function getBookableService(serviceId: string): Promise<Service> {
  const { data } = await createServiceClient().from("services").select("*").eq("id", serviceId).maybeSingle();
  if (!data || !data.is_active || !data.duration_minutes) throw new BookingError("service_unavailable");
  return data as Service;
}

export async function getAvailability(serviceId: string, from: string, to: string): Promise<{ days: DayAvailability[]; timezone: string }> {
  const ctx = await loadBookingContext();
  if (!ctx.settings.booking_enabled) throw new BookingError("booking_disabled");
  const service = await getBookableService(serviceId);
  const tz = ctx.settings.timezone;
  const busy = await loadBusy(zonedWallTimeToUtc(from, "00:00", tz), zonedWallTimeToUtc(addDaysToDate(to, 1), "00:00", tz), tz);
  const days = computeAvailability({
    ...ctx.rules,
    ...busy,
    now: new Date(),
    fromDate: from,
    toDate: to,
    durationMinutes: service.duration_minutes!,
    hours: ctx.hours,
  });
  return { days, timezone: tz };
}

function mapDbError(error: { message?: string; code?: string } | null): BookingError {
  const code = error?.message && BOOKING_ERROR_MESSAGES[error.message] ? error.message : error?.code === "23P01" ? "slot_taken" : "unknown";
  return new BookingError(code, undefined, code === "unknown" ? 500 : 409);
}

/** Finalise la réservation après revérification de la disponibilité côté serveur. */
export async function createOnlineBooking(req: BookingRequest, ip: string | null): Promise<{ booking: Booking; token: string }> {
  const ctx = await loadBookingContext();
  if (!ctx.settings.booking_enabled) throw new BookingError("booking_disabled");
  const service = await getBookableService(req.serviceId);
  const start = new Date(req.startsAt);
  const end = new Date(start.getTime() + service.duration_minutes! * 60_000);

  // 1. Revalidation complète du créneau (horaires, pauses, congés, rendez-vous, délai).
  const busy = await loadBusy(new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000), ctx.settings.timezone);
  const ok = isSlotAvailable(
    { ...ctx.rules, ...busy, now: new Date(), durationMinutes: service.duration_minutes!, hours: ctx.hours },
    start.toISOString(),
  );
  if (!ok) throw new BookingError("slot_unavailable");

  // 2. Insertion transactionnelle : verrou + contrainte d'exclusion contre les doublons simultanés.
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: service.id,
    p_starts_at: start.toISOString(),
    p_first_name: req.firstName,
    p_last_name: req.lastName,
    p_phone: req.phone,
    p_email: req.email,
    p_customer_note: req.note,
    p_source: "online",
    p_manage_token_hash: null,
    p_ip_hash: ip ? hashIp(ip, serverEnv.rateLimitSalt || serverEnv.manageTokenSecret) : null,
  });
  if (error || !data) throw mapDbError(error);
  const booking = data as Booking;
  const token = manageTokenFor(booking.id, serverEnv.manageTokenSecret);
  await supabase.from("bookings").update({ manage_token_hash: hashToken(token) }).eq("id", booking.id);
  return { booking, token };
}

export async function findBookingByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await createServiceClient()
    .from("bookings")
    .select("*, customer:customers(first_name, last_name, email)")
    .eq("manage_token_hash", hashToken(token))
    .maybeSingle();
  return data as (Booking & { customer: { first_name: string; last_name: string; email: string | null } | null }) | null;
}

export function canCustomerCancel(booking: Pick<Booking, "status" | "starts_at">, settings: Pick<BusinessSettings, "cancellation_notice_minutes">, now = new Date()) {
  return booking.status === "confirmed" && new Date(booking.starts_at).getTime() - now.getTime() >= settings.cancellation_notice_minutes * 60_000;
}

export async function cancelBookingByToken(token: string): Promise<Booking> {
  const booking = await findBookingByToken(token);
  if (!booking) throw new BookingError("not_found", "Rendez-vous introuvable.", 404);
  const ctx = await loadBookingContext();
  if (!canCustomerCancel(booking, ctx.settings)) {
    throw new BookingError("too_late", "Ce rendez-vous ne peut plus être annulé en ligne. Merci de contacter le salon.");
  }
  const { data, error } = await createServiceClient()
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "customer" })
    .eq("id", booking.id)
    .eq("status", "confirmed")
    .select()
    .single();
  if (error || !data) throw new BookingError("unknown", undefined, 500);
  return data as Booking;
}
