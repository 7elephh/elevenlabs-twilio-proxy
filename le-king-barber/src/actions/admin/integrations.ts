"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, type ActionResult } from "@/lib/auth";
import { disconnectGoogle, syncBookingToGoogle } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/notifications/email";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";

export async function setGoogleImportBusyAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createServiceClient()
    .from("calendar_integrations")
    .update({ import_busy: form.get("import_busy") === "on" })
    .eq("provider", "google");
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/admin/integrations");
  return { ok: true, message: "Préférence enregistrée." };
}

export async function disconnectGoogleAction(_prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  await disconnectGoogle();
  revalidatePath("/admin/integrations");
  return { ok: true, message: "Google Calendar déconnecté." };
}

/** Pousse vers Google les rendez-vous à venir non synchronisés ou en erreur. */
export async function resyncGoogleAction(_prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  const { data } = await createServiceClient()
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .or("google_event_id.is.null,google_sync_error.not.is.null")
    .limit(100);
  for (const b of data ?? []) await syncBookingToGoogle(b.id);
  revalidatePath("/admin/integrations");
  return { ok: true, message: `${data?.length ?? 0} rendez-vous synchronisé(s).` };
}

export async function sendTestEmailAction(_prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  if (!serverEnv.barberNotificationEmail) return { ok: false, message: "BARBER_NOTIFICATION_EMAIL n'est pas défini." };
  const r = await sendEmail({
    to: serverEnv.barberNotificationEmail,
    subject: "Test d'envoi — Le King Barber",
    text: "Les emails transactionnels du site fonctionnent.",
    html: "<p>Les emails transactionnels du site fonctionnent.</p>",
  });
  if (r.status === "sent") return { ok: true, message: `Email envoyé à ${serverEnv.barberNotificationEmail}.` };
  return { ok: false, message: r.status === "skipped" ? "Service d'email non configuré (RESEND_API_KEY / EMAIL_FROM)." : `Échec : ${r.error}` };
}
