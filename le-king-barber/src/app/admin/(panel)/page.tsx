import Link from "next/link";

import { BookingList } from "@/components/admin/booking-row";
import { Card, Empty, PageHeader } from "@/components/admin/ui";
import { bookingsBetween } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { isEmailConfigured, isGoogleConfigured, serverEnv } from "@/lib/server-env";
import { isServiceConfigured } from "@/lib/supabase/service";
import { addDaysToDate, formatDateLabel, formatPrice, localDateOf, zonedWallTimeToUtc } from "@/lib/time";

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const { data: settings } = await supabase.from("business_settings").select("timezone, booking_enabled").eq("id", 1).single();
  const tz = settings?.timezone ?? "Europe/Paris";
  const today = localDateOf(new Date(), tz);
  const dayStart = zonedWallTimeToUtc(today, "00:00", tz);
  const dayEnd = zonedWallTimeToUtc(addDaysToDate(today, 1), "00:00", tz);
  const monthStart = zonedWallTimeToUtc(`${today.slice(0, 8)}01`, "00:00", tz);
  const in30 = new Date(Date.now() - 30 * 86_400_000);

  const [todayBookings, upcoming, monthCount, monthRevenue, newCustomers, hoursCount, activeServices, google, history] = await Promise.all([
    bookingsBetween(supabase, dayStart, dayEnd, true),
    supabase
      .from("bookings")
      .select("*, customer:customers(id, first_name, last_name, phone, email)")
      .eq("status", "confirmed")
      .gte("starts_at", dayEnd.toISOString())
      .order("starts_at")
      .limit(8),
    supabase.from("bookings").select("id", { count: "exact", head: true }).neq("status", "cancelled").gte("starts_at", monthStart.toISOString()),
    supabase.from("bookings").select("price_cents").in("status", ["confirmed", "completed"]).gte("starts_at", monthStart.toISOString()),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", in30.toISOString()).is("anonymized_at", null),
    supabase.from("business_hours").select("id", { count: "exact", head: true }),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    isServiceConfigured() ? (await import("@/lib/supabase/service")).createServiceClient().from("calendar_integrations").select("provider").maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("bookings")
      .select("*, customer:customers(id, first_name, last_name, phone, email)")
      .lt("starts_at", dayStart.toISOString())
      .order("starts_at", { ascending: false })
      .limit(5),
  ]);

  const active = todayBookings.filter((b) => b.status !== "cancelled");
  const revenue = (monthRevenue.data ?? []).reduce((s, b) => s + b.price_cents, 0);

  const checklist = [
    { ok: (hoursCount.count ?? 0) > 0, label: "Horaires d'ouverture renseignés", href: "/admin/disponibilites" },
    { ok: (activeServices.count ?? 0) > 0, label: "Au moins une prestation active (avec durée)", href: "/admin/prestations" },
    { ok: Boolean(settings?.booking_enabled), label: "Réservation en ligne ouverte", href: "/admin/site#reservation" },
    { ok: isServiceConfigured() && Boolean(serverEnv.manageTokenSecret), label: "Clés serveur configurées (service Supabase, jeton de gestion)", href: "/admin/integrations" },
    { ok: isEmailConfigured(), label: "Emails de confirmation (Resend)", href: "/admin/integrations" },
    { ok: !isGoogleConfigured() ? false : Boolean(google.data), label: "Google Calendar connecté (optionnel)", href: "/admin/integrations", optional: true },
  ];
  const pending = checklist.filter((c) => !c.ok);

  return (
    <>
      <PageHeader
        title="Bonjour"
        subtitle={<span className="inline-block first-letter:uppercase">{formatDateLabel(today, "EEEE d MMMM yyyy")}</span>}
        actions={
          <Link href="/admin/rendez-vous/nouveau" className="bg-ivoire px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-noir hover:bg-champagne">
            + Rendez-vous
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-px border border-ivoire/10 bg-ivoire/10 lg:grid-cols-4">
        {[
          { label: "Aujourd'hui", value: active.length },
          { label: "Réservations du mois", value: monthCount.count ?? 0 },
          { label: "Chiffre prévu du mois", value: formatPrice(revenue) },
          { label: "Nouveaux clients (30 j)", value: newCustomers.count ?? 0 },
        ].map((k) => (
          <div key={k.label} className="bg-noir p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ivoire/45">{k.label}</p>
            <p className="mt-3 font-serif text-4xl tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Rendez-vous du jour" action={<Link href="/admin/agenda" className="text-xs text-ivoire/50 hover:text-ivoire">Agenda →</Link>}>
          {todayBookings.length ? <BookingList bookings={todayBookings} timezone={tz} /> : <Empty>Aucun rendez-vous aujourd&apos;hui.</Empty>}
        </Card>
        <Card title="À venir" action={<Link href="/admin/rendez-vous" className="text-xs text-ivoire/50 hover:text-ivoire">Tout voir →</Link>}>
          {upcoming.data?.length ? <BookingList bookings={upcoming.data} timezone={tz} showDate /> : <Empty>Aucun rendez-vous à venir.</Empty>}
        </Card>
        {pending.length > 0 && (
          <Card title="Mise en service">
            <ul className="space-y-3 text-sm">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="flex items-center gap-3 hover:text-ivoire">
                    <span className={`flex h-5 w-5 items-center justify-center border text-[10px] ${c.ok ? "border-champagne bg-champagne text-noir" : "border-ivoire/25"}`}>{c.ok ? "✓" : ""}</span>
                    <span className={c.ok ? "text-ivoire/45" : "text-ivoire/85"}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Historique récent" action={<Link href="/admin/rendez-vous?filtre=passes" className="text-xs text-ivoire/50 hover:text-ivoire">Historique →</Link>}>
          {history.data?.length ? <BookingList bookings={history.data} timezone={tz} showDate /> : <Empty>Pas encore d&apos;historique.</Empty>}
        </Card>
      </div>
    </>
  );
}
