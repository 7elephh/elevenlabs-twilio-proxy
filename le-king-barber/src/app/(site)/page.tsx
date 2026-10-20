import { About, FinalCta, Gallery, Hero, PracticalInfo, Services, Testimonials } from "@/components/site/sections";
import { SITE_URL } from "@/lib/env";
import { fullAddress, getSiteData, mediaUrl } from "@/lib/site-data";
import type { BusinessHour, BusinessSettings, Service } from "@/lib/types";

export const revalidate = 300;

const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Données structurées SEO local : uniquement les informations renseignées. */
function jsonLd(settings: BusinessSettings, hours: BusinessHour[], services: Service[]) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: settings.salon_name,
    url: SITE_URL,
    image: mediaUrl(settings.hero_image_path) ?? `${SITE_URL}/opengraph-image.png`,
    logo: `${SITE_URL}/icon.png`,
  };
  if (settings.phone) data.telephone = settings.phone;
  if (fullAddress(settings)) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address_line ?? undefined,
      postalCode: settings.postal_code ?? undefined,
      addressLocality: settings.city ?? undefined,
      addressCountry: "FR",
    };
  }
  if (settings.instagram_url) data.sameAs = [settings.instagram_url];
  if (hours.length) {
    data.openingHoursSpecification = hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[h.weekday - 1],
      opens: h.opens_at.slice(0, 5),
      closes: h.closes_at.slice(0, 5),
    }));
  }
  if (services.length) {
    data.makesOffer = services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name },
      price: (s.price_cents / 100).toFixed(2),
      priceCurrency: "EUR",
    }));
  }
  return data;
}

export default async function HomePage() {
  const { settings, services, hours, gallery, testimonials } = await getSiteData();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(settings, hours, services)).replace(/</g, "\\u003c") }} />
      <Hero settings={settings} />
      <About settings={settings} />
      <Services services={services} />
      <Gallery images={gallery} />
      <Testimonials testimonials={testimonials} reviewsUrl={settings.google_reviews_url} />
      <PracticalInfo settings={settings} hours={hours} />
      <FinalCta />
    </>
  );
}
