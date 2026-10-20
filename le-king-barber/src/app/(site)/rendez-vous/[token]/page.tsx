import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Arrow, ButtonLink } from "@/components/ui/button";
import { canCustomerCancel, findBookingByToken, loadBookingContext } from "@/lib/booking/engine";
import { googleCalendarTemplateUrl } from "@/lib/ics";
import { fullAddress, mapsUrl } from "@/lib/site-data";
import { isEmailConfigured } from "@/lib/server-env";
import { isServiceConfigured } from "@/lib/supabase/service";
import { formatDuration, formatLongDate, formatPrice, localTimeOf } from "@/lib/time";

import { CancelButton } from "./cancel-button";

export const metadata: Metadata = { title: "Mon rendez-vous", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const [{ token }, { confirmation }] = await Promise.all([params, searchParams]);
  if (!isServiceConfigured()) notFound();
  const booking = await findBookingByToken(token);
  if (!booking) notFound();
  const { settings } = await loadBookingContext();
  const tz = settings.timezone;
  const start = new Date(booking.starts_at);
  const address = fullAddress(settings);
  const directions = mapsUrl(settings);
  const cancelled = booking.status === "cancelled";
  const isPast = start.getTime() < Date.now();
  const justBooked = confirmation === "1" && !cancelled;

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10 md:pt-40">
      <p className="label animate-rise">{cancelled ? "Rendez-vous annulé" : justBooked ? "Réservation confirmée" : "Mon rendez-vous"}</p>
      <h1 className="mt-6 animate-rise text-[clamp(2.6rem,8vw,4.5rem)] leading-[0.98] [animation-delay:100ms]">
        {cancelled ? "Ce rendez-vous a été annulé." : justBooked ? `Merci ${booking.customer?.first_name ?? ""}, à très vite.` : "Votre rendez-vous"}
      </h1>
      {justBooked && (
        <p className="mt-6 max-w-lg animate-rise leading-relaxed text-ivoire/70 [animation-delay:200ms]">
          Votre créneau est réservé.{" "}
          {booking.customer?.email && isEmailConfigured() ? "Un email de confirmation vous est envoyé à l'instant." : "Conservez cette page : elle vous permet de retrouver ou d'annuler votre rendez-vous."}
        </p>
      )}

      <dl className="mt-12 animate-rise divide-y divide-ivoire/10 border-y border-ivoire/10 [animation-delay:300ms]">
        <Row label="Prestation" value={booking.service_name} />
        <Row label="Date" value={<span className="inline-block first-letter:uppercase">{formatLongDate(start, tz)}</span>} />
        <Row label="Heure" value={localTimeOf(start, tz).replace(":", "h")} />
        <Row label="Durée" value={formatDuration(booking.duration_minutes)} />
        <Row label="Tarif" value={formatPrice(booking.price_cents)} />
        {address && <Row label="Adresse" value={address} />}
      </dl>

      {!cancelled && !isPast && (
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <ButtonLink href={`/api/rendez-vous/${token}/ics`} prefetch={false}>
            Ajouter à mon agenda
          </ButtonLink>
          <ButtonLink
            href={googleCalendarTemplateUrl({ start: booking.starts_at, end: booking.ends_at, summary: `${booking.service_name} — ${settings.salon_name}`, location: address })}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            Google Agenda
          </ButtonLink>
          {directions && (
            <ButtonLink href={directions} target="_blank" rel="noopener noreferrer" variant="ghost" className="sm:px-4">
              Itinéraire <Arrow />
            </ButtonLink>
          )}
        </div>
      )}

      {!cancelled && !isPast && (
        <div className="mt-14">
          {canCustomerCancel(booking, settings) ? (
            <CancelButton token={token} />
          ) : (
            <p className="text-sm text-ivoire/55">
              L&apos;annulation en ligne n&apos;est plus possible pour ce rendez-vous.
              {settings.phone ? ` Merci de contacter le salon au ${settings.phone}.` : " Merci de contacter le salon."}
            </p>
          )}
        </div>
      )}

      {cancelled && (
        <ButtonLink href="/reserver" className="mt-10">
          Reprendre rendez-vous <Arrow />
        </ButtonLink>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivoire/45">{label}</dt>
      <dd className="text-right font-serif text-xl md:text-2xl">{value}</dd>
    </div>
  );
}
