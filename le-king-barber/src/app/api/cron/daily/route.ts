import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { notifyBooking } from "@/lib/notifications/notify";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import { addDaysToDate, localDateOf, zonedWallTimeToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const expected = `Bearer ${serverEnv.cronSecret}`;
  const got = request.headers.get("authorization") ?? "";
  return serverEnv.cronSecret.length >= 16 && got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * Tâche quotidienne (Vercel Cron) :
 * 1. Rappels par email pour les rendez-vous du lendemain (clients ayant donné un email).
 * 2. Rendez-vous passés marqués « honorés ».
 * 3. Purge RGPD (anonymisation au-delà de la durée de conservation, empreintes IP).
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("business_settings").select("timezone").eq("id", 1).single();
  const tz = settings?.timezone ?? "Europe/Paris";

  const tomorrow = addDaysToDate(localDateOf(new Date(), tz), 1);
  const from = zonedWallTimeToUtc(tomorrow, "00:00", tz).toISOString();
  const to = zonedWallTimeToUtc(addDaysToDate(tomorrow, 1), "00:00", tz).toISOString();

  const { data: due } = await supabase
    .from("bookings")
    .select("id, customer:customers!inner(email)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .not("customers.email", "is", null);

  let reminders = 0;
  for (const b of due ?? []) {
    // On marque d'abord pour ne jamais envoyer deux rappels si la tâche est relancée.
    const { data: claimed } = await supabase
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", b.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;
    await notifyBooking(b.id, "reminder");
    reminders++;
  }

  const { count: completed } = await supabase
    .from("bookings")
    .update({ status: "completed" }, { count: "exact" })
    .eq("status", "confirmed")
    .lt("ends_at", new Date(Date.now() - 6 * 3_600_000).toISOString());

  const { data: anonymized } = await supabase.rpc("purge_expired_personal_data");

  return NextResponse.json({ reminders, completed: completed ?? 0, anonymized: anonymized ?? 0 });
}
