"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, type ActionResult } from "@/lib/auth";
import { loadBookingContext } from "@/lib/booking/engine";
import { addDaysToDate, zonedWallTimeToUtc } from "@/lib/time";

const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function saveDayHoursAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const weekday = Number(form.get("weekday"));
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { ok: false, message: "Jour invalide." };
  const opens = form.getAll("opens").map(String);
  const closes = form.getAll("closes").map(String);
  const ranges = opens
    .map((o, i) => ({ opens_at: o, closes_at: closes[i] ?? "" }))
    .filter((r) => r.opens_at || r.closes_at);
  for (const r of ranges) {
    if (!time.safeParse(r.opens_at).success || !time.safeParse(r.closes_at).success) return { ok: false, message: "Heures incomplètes." };
    if (r.closes_at <= r.opens_at) return { ok: false, message: "La fermeture doit être après l'ouverture." };
  }
  const sorted = [...ranges].sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].opens_at < sorted[i - 1].closes_at) return { ok: false, message: "Les plages se chevauchent." };
  }
  const del = await supabase.from("business_hours").delete().eq("weekday", weekday);
  if (del.error) return { ok: false, message: "Enregistrement impossible." };
  if (sorted.length) {
    const ins = await supabase.from("business_hours").insert(sorted.map((r) => ({ weekday, ...r })));
    if (ins.error) return { ok: false, message: "Enregistrement impossible." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: sorted.length ? "Horaires enregistrés." : "Jour marqué comme fermé." };
}

const blockSchema = z.object({
  kind: z.enum(["vacation", "closure", "block"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début requise"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin requise"),
  startTime: z.union([z.literal(""), time]),
  endTime: z.union([z.literal(""), time]),
  reason: z.string().trim().max(200),
});

export async function addBlockedPeriodAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  const parsed = blockSchema.safeParse({
    kind: form.get("kind"),
    startDate: form.get("startDate"),
    endDate: form.get("endDate") || form.get("startDate"),
    startTime: form.get("startTime") ?? "",
    endTime: form.get("endTime") ?? "",
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;
  const { settings } = await loadBookingContext();
  const tz = settings.timezone;
  // Sans heure : journées entières (de 00h00 au lendemain 00h00, heure de Paris).
  const start = zonedWallTimeToUtc(d.startDate, d.startTime || "00:00", tz);
  const end = d.endTime ? zonedWallTimeToUtc(d.endDate, d.endTime, tz) : zonedWallTimeToUtc(addDaysToDate(d.endDate, 1), "00:00", tz);
  if (end <= start) return { ok: false, message: "La fin doit être après le début." };

  const { error } = await supabase.from("blocked_periods").insert({
    kind: d.kind,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    reason: d.reason || null,
    created_by: user.id,
  });
  if (error) return { ok: false, message: "Enregistrement impossible." };

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString());
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: count
      ? `Période ajoutée. Attention : ${count} rendez-vous déjà réservé(s) sur cette période — à annuler ou déplacer depuis l'agenda.`
      : "Période ajoutée. Les créneaux correspondants ne sont plus proposés.",
  };
}

export async function deleteBlockedPeriodAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("blocked_periods").delete().eq("id", id);
  if (error) return { ok: false, message: "Suppression impossible." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Période supprimée." };
}
