import Image from "next/image";
import Link from "next/link";

import { Arrow, ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { fullAddress, mapsUrl, mediaUrl } from "@/lib/site-data";
import { formatDuration, formatHour, formatPrice, isoWeekday, localDateOf, WEEKDAY_LABELS } from "@/lib/time";
import type { BusinessHour, BusinessSettings, GalleryImage, Service, Testimonial } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/validation";

import { Logotype, Monogram } from "./logo";

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <p className="label flex items-center gap-4">
      <span className="text-ivoire/40">{index}</span>
      <span className="rule" />
      {children}
    </p>
  );
}

export function Hero({ settings }: { settings: BusinessSettings }) {
  const image = mediaUrl(settings.hero_image_path);
  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-noir">
      {image ? (
        <>
          <Image src={image} alt="" fill priority sizes="100vw" className="animate-fade object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/55 to-noir/30" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,#26262a_0%,#111214_62%)]" />
          {/* L'opacité du filigrane est portée par le parent : l'animation ne la remplace pas. */}
          <div aria-hidden className="pointer-events-none absolute -right-[18%] top-[8%] w-[95%] max-w-[900px] opacity-[0.06] md:-right-[6%] md:top-[6%] md:w-[62%]">
            <div className="animate-fade">
              <Monogram priority />
            </div>
          </div>
        </>
      )}
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-32 md:px-10 md:pb-24">
        <p className="label animate-rise">{settings.city ? `Barbier · ${settings.city}` : "Barbier · Nouveau salon"}</p>
        <h1 className="mt-6 max-w-4xl animate-rise text-[clamp(3.1rem,11vw,7.5rem)] font-light leading-[0.95] tracking-[-0.01em] [animation-delay:120ms]">
          {settings.hero_title}
        </h1>
        {settings.hero_subtitle && (
          <p className="mt-7 max-w-md animate-rise text-base leading-relaxed text-ivoire/70 [animation-delay:240ms] md:text-lg">
            {settings.hero_subtitle}
          </p>
        )}
        <div className="mt-10 flex animate-rise flex-col gap-4 [animation-delay:360ms] sm:flex-row sm:items-center">
          <ButtonLink href="/reserver">
            Prendre rendez-vous <Arrow />
          </ButtonLink>
          <ButtonLink href="/#prestations" variant="ghost" className="justify-start sm:px-6">
            Voir les tarifs
          </ButtonLink>
        </div>
      </div>
      <div aria-hidden className="absolute bottom-0 right-5 hidden h-24 w-px overflow-hidden bg-ivoire/10 md:right-10 md:block">
        <div className="h-1/2 w-full animate-[rise_2.4s_ease-in-out_infinite] bg-champagne" />
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Écoute", text: "On commence par parler de ce que tu veux, de tes habitudes et de ton style." },
  { title: "Conseil", text: "Forme du visage, type de cheveu, implantation de la barbe : on t'oriente vers ce qui te va." },
  { title: "Finitions", text: "Contours nets, dégradés propres, barbe dessinée : le détail fait la différence." },
];

export function About({ settings }: { settings: BusinessSettings }) {
  const portrait = mediaUrl(settings.barber_photo_path);
  return (
    <section id="salon" className="scroll-mt-20 bg-noir-soft">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-12 md:gap-10 md:px-10 md:py-36">
        <Reveal className="md:col-span-5">
          <SectionLabel index="01">Le salon</SectionLabel>
          <h2 className="mt-8 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">
            {settings.about_title ?? "Le salon"}
          </h2>
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7" delay={120}>
          <p className="text-lg leading-[1.8] text-ivoire/75 md:text-xl md:leading-[1.75]">
            {settings.about_text ??
              "Le King Barber vient d'ouvrir ses portes. Ici, on prend le temps : on écoute ce que tu veux, on conseille, et on soigne chaque détail jusqu'aux finitions."}
          </p>
          {settings.experience_text && <p className="mt-6 leading-[1.8] text-ivoire/60">{settings.experience_text}</p>}
        </Reveal>

        <ol className="grid gap-px border-y border-ivoire/10 bg-ivoire/10 md:col-span-12 md:mt-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 120} className="bg-noir-soft py-10 md:px-10 md:first:pl-0">
              <span className="font-serif text-sm italic text-champagne">0{i + 1}</span>
              <h3 className="mt-4 text-3xl">{s.title}</h3>
              <p className="mt-3 max-w-xs leading-relaxed text-ivoire/60">{s.text}</p>
            </Reveal>
          ))}
        </ol>

        {settings.barber_name && (
          <Reveal className="grid items-center gap-10 md:col-span-12 md:mt-16 md:grid-cols-12">
            {portrait && (
              <div className="relative aspect-[4/5] overflow-hidden md:col-span-5">
                <Image src={portrait} alt={`Portrait de ${settings.barber_name}`} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
              </div>
            )}
            <div className={portrait ? "md:col-span-6 md:col-start-7" : "md:col-span-8"}>
              <p className="label">Ton barbier</p>
              <h3 className="mt-5 text-5xl">{settings.barber_name}</h3>
              {settings.barber_bio && <p className="mt-6 text-lg leading-[1.8] text-ivoire/70">{settings.barber_bio}</p>}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export function Services({ services }: { services: Service[] }) {
  return (
    <section id="prestations" className="scroll-mt-20 bg-ivoire text-noir">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
        <div className="grid gap-10 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            <p className="label flex items-center gap-4 text-champagne-dark">
              <span className="text-noir/40">02</span>
              <span className="h-px w-12 bg-champagne-dark/60" />
              Prestations
            </p>
            <h2 className="mt-8 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">La carte</h2>
            <p className="mt-6 max-w-sm leading-relaxed text-graphite">
              Choisis ta prestation, puis ton créneau. Pas besoin d&apos;appeler.
            </p>
          </Reveal>

          <div className="md:col-span-7">
            {services.length === 0 ? (
              <p className="border-t border-noir/15 pt-8 text-graphite">La carte des prestations sera bientôt publiée.</p>
            ) : (
              <ul className="border-t border-noir/15">
                {services.map((s, i) => (
                  <Reveal as="li" key={s.id} delay={i * 80} className="group border-b border-noir/15">
                    <Link href={`/reserver?prestation=${s.id}`} className="flex items-start gap-6 py-8 transition-colors duration-500 md:py-10">
                      <div className="flex-1">
                        <h3 className="text-[1.9rem] leading-tight transition-transform duration-700 ease-lux group-hover:translate-x-1 md:text-4xl">{s.name}</h3>
                        {s.description && <p className="mt-3 max-w-md leading-relaxed text-graphite">{s.description}</p>}
                        <p className="mt-4 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-noir/60 transition-colors group-hover:text-noir">
                          {s.duration_minutes ? formatDuration(s.duration_minutes) : null}
                          <span className="h-px w-6 bg-current opacity-40" />
                          Réserver
                          <Arrow className="transition-transform duration-500 group-hover:translate-x-1" />
                        </p>
                      </div>
                      <p className="font-serif text-3xl tabular-nums md:text-4xl">{formatPrice(s.price_cents)}</p>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Gallery({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;
  return (
    <section id="galerie" className="scroll-mt-20 bg-noir">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
        <Reveal>
          <SectionLabel index="03">Galerie</SectionLabel>
          <h2 className="mt-8 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">Le travail</h2>
        </Reveal>
        <div className="mt-14 columns-2 gap-3 md:columns-3 md:gap-5">
          {images.map((img, i) => (
            <Reveal key={img.id} delay={(i % 3) * 100} className="mb-3 break-inside-avoid md:mb-5">
              <div className="relative aspect-[4/5] overflow-hidden bg-noir-soft">
                <Image
                  src={mediaUrl(img.storage_path)!}
                  alt={img.alt}
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-[1.6s] ease-lux hover:scale-[1.03]"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials({ testimonials, reviewsUrl }: { testimonials: Testimonial[]; reviewsUrl: string | null }) {
  if (testimonials.length === 0 && !reviewsUrl) return null;
  return (
    <section id="avis" className="scroll-mt-20 border-t border-ivoire/10 bg-noir">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <Reveal>
          <SectionLabel index="04">Avis clients</SectionLabel>
        </Reveal>
        {testimonials.length > 0 && (
          <div className="mt-12 grid gap-px bg-ivoire/10 md:grid-cols-3">
            {testimonials.slice(0, 6).map((t, i) => (
              <Reveal key={t.id} delay={i * 100} className="flex flex-col bg-noir p-8 md:p-10">
                {t.rating && (
                  <p aria-label={`${t.rating} sur 5`} className="tracking-[0.3em] text-champagne">
                    {"★".repeat(t.rating)}
                    <span className="text-ivoire/15">{"★".repeat(5 - t.rating)}</span>
                  </p>
                )}
                <blockquote className="mt-6 flex-1 font-serif text-2xl leading-snug text-ivoire/90">« {t.content} »</blockquote>
                <p className="mt-8 text-[12px] uppercase tracking-[0.2em] text-ivoire/50">
                  {t.author_name}
                  {t.source ? ` · ${t.source}` : ""}
                </p>
              </Reveal>
            ))}
          </div>
        )}
        {reviewsUrl && (
          <a href={reviewsUrl} target="_blank" rel="noopener noreferrer" className="mt-10 inline-flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-ivoire/70 hover:text-champagne">
            Lire les avis Google <Arrow />
          </a>
        )}
      </div>
    </section>
  );
}

export function PracticalInfo({ settings, hours }: { settings: BusinessSettings; hours: BusinessHour[] }) {
  const address = fullAddress(settings);
  const directions = mapsUrl(settings);
  const byDay = WEEKDAY_LABELS.map((label, i) => ({
    label,
    ranges: hours.filter((h) => h.weekday === i + 1).map((h) => `${formatHour(h.opens_at)} – ${formatHour(h.closes_at)}`),
  }));
  const today = isoWeekday(localDateOf(new Date(), settings.timezone));

  return (
    <section id="infos" className="scroll-mt-20 border-t border-ivoire/10 bg-noir-soft">
      <div className="mx-auto grid max-w-7xl gap-16 px-5 py-24 md:grid-cols-12 md:px-10 md:py-36">
        <Reveal className="md:col-span-5">
          <SectionLabel index="05">Infos pratiques</SectionLabel>
          <h2 className="mt-8 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">Nous trouver</h2>

          <dl className="mt-12 space-y-10">
            <div>
              <dt className="label">Adresse</dt>
              <dd className="mt-3 text-lg leading-relaxed text-ivoire/80">{address ?? "Adresse communiquée prochainement."}</dd>
              {directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-ivoire hover:text-champagne">
                  Itinéraire <Arrow />
                </a>
              )}
            </div>
            <div>
              <dt className="label">Contact</dt>
              <dd className="mt-3 space-y-2 text-lg text-ivoire/80">
                {settings.phone ? (
                  <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="block hover:text-champagne">
                    {settings.phone.startsWith("+") ? formatPhoneDisplay(settings.phone) : settings.phone}
                  </a>
                ) : (
                  <span className="block text-ivoire/50">Téléphone communiqué prochainement.</span>
                )}
                {settings.instagram_url && (
                  <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="block hover:text-champagne">
                    Instagram
                  </a>
                )}
              </dd>
            </div>
          </dl>
        </Reveal>

        <Reveal className="md:col-span-6 md:col-start-7" delay={120}>
          <p className="label">Horaires</p>
          {hours.length === 0 ? (
            <p className="mt-6 text-ivoire/60">Horaires communiqués prochainement.</p>
          ) : (
            <table className="mt-6 w-full text-left">
              <caption className="sr-only">Horaires d&apos;ouverture</caption>
              <tbody>
                {byDay.map((d, i) => (
                  <tr key={d.label} className={`border-b border-ivoire/10 ${i + 1 === today ? "text-ivoire" : "text-ivoire/65"}`}>
                    <th scope="row" className="py-4 pr-4 font-normal">
                      {d.label}
                      {i + 1 === today && <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-champagne">Aujourd&apos;hui</span>}
                    </th>
                    <td className="py-4 text-right tabular-nums">{d.ranges.length ? d.ranges.join("  ·  ") : <span className="text-ivoire/35">Fermé</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-noir">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-28 text-center md:px-10 md:py-40">
        <Reveal className="flex flex-col items-center">
          <Logotype className="h-auto w-52 md:w-64" />
          <p className="mt-12 max-w-md text-lg leading-relaxed text-ivoire/65">Ta prochaine coupe, réservée en moins d&apos;une minute.</p>
          <ButtonLink href="/reserver" className="mt-10">
            Prendre rendez-vous <Arrow />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
