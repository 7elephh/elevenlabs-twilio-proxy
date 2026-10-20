import type { Metadata } from "next";

import { BookingFlow } from "@/components/booking/booking-flow";
import { ButtonLink } from "@/components/ui/button";
import { getSiteData } from "@/lib/site-data";
import { isServiceConfigured } from "@/lib/supabase/service";
import { localDateOf } from "@/lib/time";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description: "Réservez votre coupe ou votre taille de barbe chez Le King Barber : choisissez la prestation, le jour et l'heure.",
  alternates: { canonical: "/reserver" },
};

export const dynamic = "force-dynamic";

export default async function ReserverPage({ searchParams }: { searchParams: Promise<{ prestation?: string }> }) {
  const { prestation } = await searchParams;
  const { configured, settings, services, hours } = await getSiteData();
  const ready = configured && isServiceConfigured() && settings.booking_enabled && services.length > 0 && hours.length > 0;

  if (!ready) {
    return (
      <section className="mx-auto flex min-h-[80svh] max-w-3xl flex-col justify-center px-5 pb-24 pt-36 md:px-10">
        <p className="label">Réservation</p>
        <h1 className="mt-6 text-[clamp(2.6rem,8vw,4.5rem)] leading-none">Bientôt disponible</h1>
        <p className="mt-8 max-w-lg text-lg leading-relaxed text-ivoire/70">
          La réservation en ligne ouvrira très prochainement.
          {settings.phone ? " En attendant, le salon reste joignable par téléphone." : ""}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          {settings.phone && <ButtonLink href={`tel:${settings.phone.replace(/\s/g, "")}`}>Appeler le salon</ButtonLink>}
          <ButtonLink href="/" variant="outline">Retour à l&apos;accueil</ButtonLink>
        </div>
      </section>
    );
  }

  return (
    <BookingFlow
      services={services}
      today={localDateOf(new Date(), settings.timezone)}
      maxAdvanceDays={settings.max_advance_days}
      initialServiceId={prestation ?? null}
      salonPhone={settings.phone}
    />
  );
}
