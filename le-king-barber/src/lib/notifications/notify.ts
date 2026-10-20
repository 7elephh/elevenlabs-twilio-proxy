import "server-only";

import { SITE_URL } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import { fullAddress } from "@/lib/site-data";
import { manageTokenFor } from "@/lib/tokens";
import type { BusinessSettings } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/validation";

import { sendEmail, type EmailResult } from "./email";
import { renderBookingEmail, type BookingEmailKind } from "./templates";

async function log(bookingId: string, kind: BookingEmailKind, recipient: string | null, result: EmailResult) {
  await createServiceClient()
    .from("notification_log")
    .insert({
      booking_id: bookingId,
      kind,
      recipient,
      status: result.status,
      provider_message_id: result.status === "sent" ? result.id : null,
      error: result.status === "failed" ? result.error.slice(0, 300) : result.status === "skipped" ? result.reason : null,
    });
}

/**
 * Envoie les emails liés à un évènement de réservation et les journalise.
 * - Client : uniquement s'il a donné un email.
 * - Salon : à chaque nouvelle réservation en ligne et annulation client.
 * Si le service d'email n'est pas configuré, l'évènement est journalisé « skipped ».
 */
export async function notifyBooking(bookingId: string, event: "created" | "cancelled_by_customer" | "cancelled_by_admin" | "updated" | "reminder") {
  const supabase = createServiceClient();
  const [{ data: b }, { data: s }] = await Promise.all([
    supabase.from("bookings").select("*, customer:customers(first_name, last_name, phone, email)").eq("id", bookingId).single(),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
  ]);
  if (!b || !s) return;
  const settings = s as BusinessSettings;
  const customer = b.customer as { first_name: string; last_name: string; phone: string; email: string | null } | null;
  if (!customer) return;

  const manageUrl =
    serverEnv.manageTokenSecret && b.status === "confirmed"
      ? `${SITE_URL}/rendez-vous/${manageTokenFor(b.id, serverEnv.manageTokenSecret)}`
      : null;
  const data = {
    salonName: settings.salon_name,
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: formatPhoneDisplay(customer.phone),
    serviceName: b.service_name,
    priceCents: b.price_cents,
    durationMinutes: b.duration_minutes,
    startsAt: b.starts_at,
    timezone: settings.timezone,
    address: fullAddress(settings),
    salonPhone: settings.phone,
    manageUrl,
    note: b.customer_note,
  };
  const ics = buildIcs({
    uid: b.id,
    start: b.starts_at,
    end: b.ends_at,
    summary: `${b.service_name} — ${settings.salon_name}`,
    location: fullAddress(settings),
    cancelled: b.status === "cancelled",
  });

  const customerKind: Record<typeof event, BookingEmailKind> = {
    created: "confirmation",
    cancelled_by_customer: "cancellation",
    cancelled_by_admin: "cancellation",
    updated: "update",
    reminder: "reminder",
  };

  const tasks: Promise<void>[] = [];
  if (customer.email) {
    const kind = customerKind[event];
    const mail = renderBookingEmail(kind, data);
    tasks.push(
      sendEmail({
        to: customer.email,
        ...mail,
        replyTo: settings.email,
        attachments: kind === "reminder" ? undefined : [{ filename: "rendez-vous.ics", content: ics, contentType: "text/calendar" }],
      }).then((r) => log(b.id, kind, customer.email, r)),
    );
  }
  if (serverEnv.barberNotificationEmail && (event === "created" || event === "cancelled_by_customer")) {
    const kind: BookingEmailKind = event === "created" ? "barber_new" : "cancellation";
    const mail = renderBookingEmail(kind, data);
    tasks.push(
      sendEmail({
        to: serverEnv.barberNotificationEmail,
        ...mail,
        subject: event === "created" ? mail.subject : `Annulation client — ${customer.first_name} ${customer.last_name}`,
      }).then((r) => log(b.id, kind, serverEnv.barberNotificationEmail, r)),
    );
  }
  await Promise.allSettled(tasks);
}
