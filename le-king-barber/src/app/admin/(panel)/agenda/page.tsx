import { addDays, endOfMonth, format, parseISO, startOfISOWeek, startOfMonth } from "date-fns";
import Link from "next/link";

import { PageHeader } from "@/components/admin/ui";
import { bookingsBetween, customerName } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { addDaysToDate, formatDateLabel, isValidDateString, isoWeekday, localDateOf, localTimeOf, zonedWallTimeToUtc } from "@/lib/time";
import type { BlockedPeriod, BookingWithCustomer, BusinessHour } from "@/lib/types";

type View = "jour" | "semaine" | "mois";
const HOUR_PX = 64;

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vue?: string; date?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const { data: settings } = await supabase.from("business_settings").select("timezone").eq("id", 1).single();
  const tz = settings?.timezone ?? "Europe/Paris";
  const view: View = sp.vue === "jour" || sp.vue === "mois" ? sp.vue : sp.vue === "semaine" ? "semaine" : "jour";
  const today = localDateOf(new Date(), tz);
  const anchor = sp.date && isValidDateString(sp.date) ? sp.date : today;

  let days: string[];
  let prev: string;
  let next: string;
  let title: string;
  if (view === "jour") {
    days = [anchor];
    prev = addDaysToDate(anchor, -1);
    next = addDaysToDate(anchor, 1);
    title = formatDateLabel(anchor, "EEEE d MMMM yyyy");
  } else if (view === "semaine") {
    const monday = ymd(startOfISOWeek(parseISO(anchor)));
    days = Array.from({ length: 7 }, (_, i) => addDaysToDate(monday, i));
    prev = addDaysToDate(monday, -7);
    next = addDaysToDate(monday, 7);
    title = `Semaine du ${formatDateLabel(monday, "d MMMM yyyy")}`;
  } else {
    const first = startOfMonth(parseISO(anchor));
    const gridStart = ymd(startOfISOWeek(first));
    const last = ymd(endOfMonth(first));
    days = [];
    for (let d = gridStart; d <= last || isoWeekday(d) !== 1; d = addDaysToDate(d, 1)) days.push(d);
    prev = ymd(addDays(first, -1));
    next = ymd(addDays(endOfMonth(first), 1));
    title = format(first, "MMMM yyyy", { locale: (await import("date-fns/locale")).fr });
  }

  const rangeStart = zonedWallTimeToUtc(days[0], "00:00", tz);
  const rangeEnd = zonedWallTimeToUtc(addDaysToDate(days[days.length - 1], 1), "00:00", tz);
  const [bookings, blockedRes, hoursRes] = await Promise.all([
    bookingsBetween(supabase, rangeStart, rangeEnd, true),
    supabase.from("blocked_periods").select("*").lt("starts_at", rangeEnd.toISOString()).gt("ends_at", rangeStart.toISOString()),
    supabase.from("business_hours").select("*"),
  ]);
  const blocked = (blockedRes.data ?? []) as BlockedPeriod[];
  const hours = (hoursRes.data ?? []) as BusinessHour[];

  const tabs: { id: View; label: string }[] = [
    { id: "jour", label: "Jour" },
    { id: "semaine", label: "Semaine" },
    { id: "mois", label: "Mois" },
  ];

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={<span className="inline-block first-letter:uppercase">{title}</span>}
        actions={
          <>
            <div className="flex border border-ivoire/15">
              {tabs.map((t) => (
                <Link key={t.id} href={`/admin/agenda?vue=${t.id}&date=${anchor}`} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${view === t.id ? "bg-ivoire text-noir" : "text-ivoire/60 hover:text-ivoire"}`}>
                  {t.label}
                </Link>
              ))}
            </div>
            <div className="flex border border-ivoire/15">
              <Link href={`/admin/agenda?vue=${view}&date=${prev}`} aria-label="Précédent" className="px-4 py-2.5 text-ivoire/70 hover:text-ivoire">←</Link>
              <Link href={`/admin/agenda?vue=${view}&date=${today}`} className="border-x border-ivoire/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivoire/70 hover:text-ivoire">Aujourd&apos;hui</Link>
              <Link href={`/admin/agenda?vue=${view}&date=${next}`} aria-label="Suivant" className="px-4 py-2.5 text-ivoire/70 hover:text-ivoire">→</Link>
            </div>
            <Link href={`/admin/rendez-vous/nouveau?date=${anchor}`} className="bg-ivoire px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-noir hover:bg-champagne">+ Rendez-vous</Link>
          </>
        }
      />
      {view === "mois" ? (
        <MonthGrid days={days} month={anchor.slice(0, 7)} today={today} bookings={bookings} blocked={blocked} tz={tz} />
      ) : (
        <TimeGrid days={days} today={today} bookings={bookings} blocked={blocked} hours={hours} tz={tz} />
      )}
    </>
  );
}

function minutesOf(instant: Date, tz: string) {
  const [h, m] = localTimeOf(instant, tz).split(":").map(Number);
  return h * 60 + m;
}

function TimeGrid({ days, today, bookings, blocked, hours, tz }: { days: string[]; today: string; bookings: BookingWithCustomer[]; blocked: BlockedPeriod[]; hours: BusinessHour[]; tz: string }) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const relevant = hours.filter((h) => days.some((d) => isoWeekday(d) === h.weekday));
  let startMin = relevant.length ? Math.min(...relevant.map((h) => toMin(h.opens_at))) : 9 * 60;
  let endMin = relevant.length ? Math.max(...relevant.map((h) => toMin(h.closes_at))) : 19 * 60;
  for (const b of bookings) {
    startMin = Math.min(startMin, minutesOf(new Date(b.starts_at), tz));
    endMin = Math.max(endMin, minutesOf(new Date(b.ends_at), tz) || 24 * 60);
  }
  startMin = Math.floor(startMin / 60) * 60;
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);
  const hoursList = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin / 60 + i);
  const height = ((endMin - startMin) / 60) * HOUR_PX;
  const top = (min: number) => ((min - startMin) / 60) * HOUR_PX;
  const multi = days.length > 1;

  return (
    <div className="overflow-x-auto border border-ivoire/10">
      <div className={multi ? "min-w-[760px]" : ""}>
        <div className="grid border-b border-ivoire/10" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <Link key={d} href={`/admin/agenda?vue=jour&date=${d}`} className={`border-l border-ivoire/10 px-3 py-3 text-center ${d === today ? "text-champagne" : "text-ivoire/70"}`}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{formatDateLabel(d, "EEE")}</span>{" "}
              <span className="font-serif text-xl">{formatDateLabel(d, "d")}</span>
            </Link>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div className="relative" style={{ height }}>
            {hoursList.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-ivoire/35" style={{ top: top(h * 60) }}>
                {h}h
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayStart = zonedWallTimeToUtc(d, "00:00", tz).getTime();
            const dayEnd = zonedWallTimeToUtc(addDaysToDate(d, 1), "00:00", tz).getTime();
            const open = hours.filter((h) => h.weekday === isoWeekday(d));
            const clip = (s: Date, e: Date) => {
              const a = Math.max(s.getTime(), dayStart);
              const b = Math.min(e.getTime(), dayEnd);
              const startM = a === dayStart ? 0 : minutesOf(new Date(a), tz);
              const endM = b === dayEnd ? 24 * 60 : minutesOf(new Date(b), tz);
              return { t: Math.max(0, top(startM)), h: Math.max(18, top(Math.min(endM, endMin)) - Math.max(0, top(startM))) };
            };
            return (
              <div key={d} className="relative border-l border-ivoire/10 bg-[repeating-linear-gradient(135deg,rgba(242,237,228,0.035)_0_2px,transparent_2px_9px)]" style={{ height }}>
                {/* Plages ouvertes */}
                {open.map((h) => (
                  <div key={h.id} className="absolute inset-x-0 bg-noir" style={{ top: top(toMin(h.opens_at)), height: top(toMin(h.closes_at)) - top(toMin(h.opens_at)) }} />
                ))}
                {hoursList.map((h) => (
                  <Link
                    key={h}
                    href={`/admin/rendez-vous/nouveau?date=${d}&heure=${String(h).padStart(2, "0")}:00`}
                    aria-label={`Ajouter un rendez-vous le ${d} à ${h}h`}
                    className="absolute inset-x-0 border-t border-ivoire/[0.06] hover:bg-ivoire/[0.03]"
                    style={{ top: top(h * 60), height: HOUR_PX }}
                  />
                ))}
                {blocked
                  .filter((b) => new Date(b.starts_at).getTime() < dayEnd && new Date(b.ends_at).getTime() > dayStart)
                  .map((b) => {
                    const p = clip(new Date(b.starts_at), new Date(b.ends_at));
                    return (
                      <Link key={b.id} href="/admin/disponibilites" className="absolute inset-x-0 z-10 overflow-hidden bg-[repeating-linear-gradient(135deg,rgba(242,237,228,0.06)_0_6px,transparent_6px_12px)] px-2 py-1 text-[11px] text-ivoire/50" style={{ top: p.t, height: p.h }}>
                        {b.kind === "vacation" ? "Congés" : b.kind === "closure" ? "Fermeture" : "Bloqué"}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </Link>
                    );
                  })}
                {bookings
                  .filter((b) => localDateOf(new Date(b.starts_at), tz) === d)
                  .map((b) => {
                    const s = new Date(b.starts_at);
                    const p = clip(s, new Date(b.ends_at));
                    const cancelled = b.status === "cancelled";
                    return (
                      <Link
                        key={b.id}
                        href={`/admin/rendez-vous/${b.id}`}
                        className={`absolute inset-x-1 z-20 overflow-hidden border-l-2 px-2 py-1 text-[12px] leading-tight transition-colors ${
                          cancelled ? "border-ivoire/20 bg-transparent text-ivoire/35 line-through" : "border-champagne bg-[#25231f] text-ivoire hover:bg-[#2f2c26]"
                        }`}
                        style={{ top: p.t + 1, height: p.h - 2 }}
                      >
                        <span className="tabular-nums text-champagne">{localTimeOf(s, tz)}</span> {customerName(b)}
                        <span className="block truncate text-ivoire/55">{b.service_name}</span>
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ days, month, today, bookings, blocked, tz }: { days: string[]; month: string; today: string; bookings: BookingWithCustomer[]; blocked: BlockedPeriod[]; tz: string }) {
  return (
    <div className="border border-ivoire/10">
      <div className="grid grid-cols-7 border-b border-ivoire/10">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-ivoire/45">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayStart = zonedWallTimeToUtc(d, "00:00", tz).getTime();
          const dayEnd = zonedWallTimeToUtc(addDaysToDate(d, 1), "00:00", tz).getTime();
          const list = bookings.filter((b) => b.status !== "cancelled" && localDateOf(new Date(b.starts_at), tz) === d);
          const isBlocked = blocked.some((b) => new Date(b.starts_at).getTime() <= dayStart && new Date(b.ends_at).getTime() >= dayEnd);
          const inMonth = d.startsWith(month);
          return (
            <Link
              key={d}
              href={`/admin/agenda?vue=jour&date=${d}`}
              className={`min-h-[84px] border-b border-r border-ivoire/10 p-1.5 transition-colors hover:bg-ivoire/[0.03] md:min-h-[112px] md:p-2 ${inMonth ? "" : "opacity-35"} ${isBlocked ? "bg-[repeating-linear-gradient(135deg,rgba(242,237,228,0.05)_0_6px,transparent_6px_12px)]" : ""}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${d === today ? "bg-champagne text-noir" : "text-ivoire/70"}`}>{Number(d.slice(8))}</span>
              {list.length > 0 && <span className="ml-1 text-[10px] text-champagne md:hidden">{list.length} rdv</span>}
              <ul className="mt-1 hidden space-y-0.5 md:block">
                {list.slice(0, 3).map((b) => (
                  <li key={b.id} className="truncate text-[11px] text-ivoire/80">
                    <span className="tabular-nums text-champagne">{localTimeOf(new Date(b.starts_at), tz)}</span> {customerName(b)}
                  </li>
                ))}
                {list.length > 3 && <li className="text-[11px] text-ivoire/45">+ {list.length - 3} autres</li>}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
