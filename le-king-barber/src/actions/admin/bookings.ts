"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { isSlotAvailable } from "@/lib/booking/availability";
import { loadBookingContext, loadBusy } from "@/lib/booking/engine";
import { requireAdmin, type ActionResult } from "@/lib/auth";
import { syncBookingToGoogle } from "@/lib/google/calendar";
import { notifyBooking } from "@/lib/notifications/notify";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import { zonedWallTimeToUtc } from "@/lib/time";
import { hashToken, manageTokenFor } from "@/lib/tokens";
import { BOOKING_ERROR_MESSAGES, normalizePhone } from "@/lib/validation";

const dateTime = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
};

const createSchema = z.object({
  serviceId: z.uuid("Choisissez une prestation"),
  ...dateTime,
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  phone: z.string().trim(),
  email: z.union([z.literal(""), z.email("Email invalide")]),
  adminNote: z.string().trim().max(1000),
  force: z.boolean(),
  notify: z.boolean(),
});

function after_(bookingId: string, event: Parameters<typeof notifyBooking>[1] | null) {
  after(async () => {
    await Promise.allSettled([event ? notifyBooking(bookingId, event) : Promise.resolve(), syncBookingToGoogle(bookingId)]);
  });
}

/** Vérifie qu'un créneau respecte horaires, pauses, congés et autres rendez-vous. */
async function slotFits(start: Date, durationMinutes: number, excludeBookingId?: string) {
  const ctx = await loadBookingContext();
  const busy = await loadBusy(new Date(start.getTime() - 86_400_000), new Date(start.getTime() + 2 * 86_400_000), ctx.settings.timezone, excludeBookingId);
  return isSlotAvailable(
    { ...ctx.rules, minNoticeMinutes: 0, slotIntervalMinutes: 5, maxAdvanceDays: 365, ...busy, now: new Date(Date.now() - 86_400_000), durationMinutes, hours: ctx.hours },
    start.toISOString(),
  );
}

export async function createAdminBookingAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    serviceId: form.get("serviceId"),
    date: form.get("date"),
    time: form.get("time"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    phone: form.get("phone"),
    email: form.get("email") ?? "",
    adminNote: form.get("adminNote") ?? "",
    force: form.get("force") === "on",
    notify: form.get("notify") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, message: "Numéro de téléphone invalide." };

  const supabase = createServiceClient();
  const ctx = await loadBookingContext();
  const start = zonedWallTimeToUtc(d.date, d.time, ctx.settings.timezone);
  const { data: service } = await supabase.from("services").select("duration_minutes").eq("id", d.serviceId).single();
  if (!service?.duration_minutes) return { ok: false, message: "Cette prestation n'a pas de durée définie." };
  if (!d.force && !(await slotFits(start, service.duration_minutes))) {
    return { ok: false, message: "Créneau hors horaires, pendant une pause/un congé ou déjà occupé. Cochez « Forcer » pour l'ajouter quand même hors horaires." };
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: d.serviceId,
    p_starts_at: start.toISOString(),
    p_first_name: d.firstName,
    p_last_name: d.lastName,
    p_phone: phone,
    p_email: d.email || null,
    p_customer_note: null,
    p_source: "admin",
    p_manage_token_hash: null,
  });
  if (error || !data) return { ok: false, message: BOOKING_ERROR_MESSAGES[error?.message ?? ""] ?? "Création impossible." };
  const id = (data as { id: string }).id;
  await supabase
    .from("bookings")
    .update({
      admin_note: d.adminNote || null,
      manage_token_hash: serverEnv.manageTokenSecret ? hashToken(manageTokenFor(id, serverEnv.manageTokenSecret)) : null,
    })
    .eq("id", id);
  after_(id, d.notify && d.email ? "created" : null);
  revalidatePath("/admin", "layout");
  redirect(`/admin/rendez-vous/${id}?cree=1`);
}

const updateSchema = z.object({
  serviceId: z.uuid(),
  ...dateTime,
  adminNote: z.string().trim().max(1000),
  force: z.boolean(),
  notify: z.boolean(),
});

export async function updateBookingAction(id: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = updateSchema.safeParse({
    serviceId: form.get("serviceId"),
    date: form.get("date"),
    time: form.get("time"),
    adminNote: form.get("adminNote") ?? "",
    force: form.get("force") === "on",
    notify: form.get("notify") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;

  const { data: current } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (!current) return { ok: false, message: "Rendez-vous introuvable." };
  if (current.status === "cancelled") return { ok: false, message: "Un rendez-vous annulé ne peut pas être modifié." };

  const ctx = await loadBookingContext();
  const start = zonedWallTimeToUtc(d.date, d.time, ctx.settings.timezone);
  const changes: Record<string, unknown> = { admin_note: d.adminNote || null };
  let duration = current.duration_minutes as number;
  if (d.serviceId !== current.service_id) {
    const { data: service } = await supabase.from("services").select("name, price_cents, duration_minutes").eq("id", d.serviceId).single();
    if (!service?.duration_minutes) return { ok: false, message: "Cette prestation n'a pas de durée définie." };
    duration = service.duration_minutes;
    Object.assign(changes, { service_id: d.serviceId, service_name: service.name, price_cents: service.price_cents, duration_minutes: duration });
  }
  const moved = start.toISOString() !== new Date(current.starts_at).toISOString() || duration !== current.duration_minutes;
  if (moved) {
    if (!d.force && !(await slotFits(start, duration, id))) {
      return { ok: false, message: "Ce nouvel horaire n'est pas disponible. Cochez « Forcer » pour ignorer les horaires d'ouverture." };
    }
    Object.assign(changes, { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + duration * 60_000).toISOString(), reminder_sent_at: null });
  }
  const { error } = await supabase.from("bookings").update(changes).eq("id", id);
  if (error) return { ok: false, message: error.code === "23P01" ? "Ce créneau chevauche un autre rendez-vous." : "Enregistrement impossible." };
  after_(id, moved && d.notify ? "updated" : null);
  revalidatePath("/admin", "layout");
  return { ok: true, message: moved ? "Rendez-vous déplacé." : "Modifications enregistrées." };
}

export async function cancelBookingAdminAction(id: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error, data } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "admin" })
    .eq("id", id)
    .neq("status", "cancelled")
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Annulation impossible." };
  after_(id, form.get("notify") === "on" ? "cancelled_by_admin" : null);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Rendez-vous annulé. Le créneau est de nouveau disponible." };
}

export async function setBookingStatusAction(id: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const status = z.enum(["confirmed", "completed", "no_show"]).safeParse(form.get("status"));
  if (!status.success) return { ok: false, message: "Statut invalide." };
  const { error } = await supabase.from("bookings").update({ status: status.data }).eq("id", id).neq("status", "cancelled");
  if (error) return { ok: false, message: "Mise à jour impossible." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Statut mis à jour." };
}
