"use client";

import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Arrow, Button } from "@/components/ui/button";
import type { DayAvailability, Slot } from "@/lib/booking/availability";
import { formatDuration, formatPrice } from "@/lib/time";
import type { Service } from "@/lib/types";

type Step = "service" | "slot" | "details";
const WINDOW_DAYS = 14;

const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Prestation" },
  { id: "slot", label: "Créneau" },
  { id: "details", label: "Coordonnées" },
];

interface Props {
  services: Service[];
  today: string;
  maxAdvanceDays: number;
  initialServiceId: string | null;
  salonPhone: string | null;
}

const shift = (date: string, days: number) => format(addDays(parseISO(date), days), "yyyy-MM-dd");
const longDate = (date: string) => format(parseISO(date), "EEEE d MMMM", { locale: fr });

export function BookingFlow({ services, today, maxAdvanceDays, initialServiceId, salonPhone }: Props) {
  const router = useRouter();
  const initial = services.find((s) => s.id === initialServiceId) ?? null;
  const [step, setStep] = useState<Step>(initial ? "slot" : "service");
  const [service, setService] = useState<Service | null>(initial);
  const [windowStart, setWindowStart] = useState(today);
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastDay = shift(today, maxAdvanceDays);

  const loadDays = useCallback(
    async (serviceId: string, from: string, keepSelection = false) => {
      setLoading(true);
      setDays(null);
      try {
        const to = shift(from, WINDOW_DAYS - 1);
        const res = await fetch(`/api/availability?serviceId=${serviceId}&from=${from}&to=${to > lastDay ? lastDay : to}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message);
        const list = json.days as DayAvailability[];
        setDays(list);
        if (!keepSelection) {
          const first = list.find((d) => d.slots.length > 0);
          setDate(first?.date ?? null);
          setSlot(null);
        }
      } catch (e) {
        setDays([]);
        setNotice(e instanceof Error && e.message ? e.message : "Impossible de charger les disponibilités.");
      } finally {
        setLoading(false);
      }
    },
    [lastDay],
  );

  useEffect(() => {
    if (service && step === "slot") void loadDays(service.id, windowStart, Boolean(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, windowStart]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const selectedDay = useMemo(() => days?.find((d) => d.date === date) ?? null, [days, date]);
  const groups = useMemo(() => {
    const slots = selectedDay?.slots ?? [];
    return [
      { label: "Matin", slots: slots.filter((s) => s.label < "12:00") },
      { label: "Après-midi", slots: slots.filter((s) => s.label >= "12:00" && s.label < "17:00") },
      { label: "Fin de journée", slots: slots.filter((s) => s.label >= "17:00") },
    ].filter((g) => g.slots.length);
  }, [selectedDay]);

  function chooseService(s: Service) {
    setService(s);
    setSlot(null);
    setDate(null);
    setWindowStart(today);
    setNotice(null);
    setStep("slot");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!service || !slot) return;
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setNotice(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          startsAt: slot.start,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          phone: form.get("phone"),
          email: form.get("email") || "",
          note: form.get("note") || "",
          privacyAccepted: form.get("privacy") === "on",
          website: form.get("website") || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 201 && json.token) {
        router.push(`/rendez-vous/${json.token}?confirmation=1`);
        return;
      }
      if (res.status === 422) {
        setFieldErrors(json.fieldErrors ?? {});
        setNotice(json.message ?? "Merci de vérifier le formulaire.");
      } else if (res.status === 409 && ["slot_taken", "slot_unavailable"].includes(json.error)) {
        setNotice(json.message);
        setSlot(null);
        setStep("slot");
        void loadDays(service.id, windowStart, true);
      } else {
        setNotice(json.message ?? "Une erreur est survenue. Merci de réessayer.");
      }
    } catch {
      setNotice("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-5 pb-40 pt-28 md:grid-cols-12 md:px-10 md:pb-24 md:pt-36">
      <div className="min-w-0 md:col-span-8">
        <ol className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]" aria-label="Étapes">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <button
                type="button"
                disabled={i > stepIndex || (s.id !== "service" && !service)}
                onClick={() => setStep(s.id)}
                aria-current={s.id === step ? "step" : undefined}
                className={`transition-colors ${s.id === step ? "text-ivoire" : i < stepIndex ? "text-champagne hover:text-ivoire" : "text-ivoire/30"}`}
              >
                <span className="font-serif text-sm normal-case italic tracking-normal">0{i + 1}</span> <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-ivoire/20 sm:w-10" />}
            </li>
          ))}
        </ol>

        {notice && (
          <p role="alert" className="mt-8 border-l-2 border-champagne bg-ivoire/[0.04] px-5 py-4 text-sm leading-relaxed text-ivoire/90">
            {notice}
          </p>
        )}

        {step === "service" && (
          <section aria-labelledby="step-title" className="mt-10 animate-rise">
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(2.4rem,7vw,3.75rem)] leading-none outline-none">
              Choisissez votre prestation
            </h1>
            <div className="mt-10 border-t border-ivoire/10" role="radiogroup" aria-label="Prestations">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={service?.id === s.id}
                  onClick={() => chooseService(s)}
                  className="group flex w-full items-center gap-5 border-b border-ivoire/10 py-7 text-left transition-colors hover:bg-ivoire/[0.02]"
                >
                  <span className="flex-1">
                    <span className="block font-serif text-[1.75rem] leading-tight md:text-3xl">{s.name}</span>
                    {s.description && <span className="mt-2 block max-w-md text-sm leading-relaxed text-ivoire/55">{s.description}</span>}
                    <span className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne">{formatDuration(s.duration_minutes ?? 0)}</span>
                  </span>
                  <span className="font-serif text-3xl tabular-nums">{formatPrice(s.price_cents)}</span>
                  <Arrow className="hidden text-ivoire/40 transition-all duration-500 group-hover:translate-x-1 group-hover:text-champagne sm:block" />
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "slot" && service && (
          <section aria-labelledby="step-title" className="mt-10 animate-rise">
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(2.4rem,7vw,3.75rem)] leading-none outline-none">
              Choisissez votre créneau
            </h1>

            <div className="mt-10 flex items-center justify-between">
              <p className="label">{format(parseISO(windowStart), "MMMM yyyy", { locale: fr })}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Dates précédentes"
                  disabled={windowStart <= today || loading}
                  onClick={() => setWindowStart((w) => (shift(w, -WINDOW_DAYS) < today ? today : shift(w, -WINDOW_DAYS)))}
                  className="flex h-11 w-11 items-center justify-center border border-ivoire/15 transition-colors hover:border-champagne disabled:opacity-25"
                >
                  <Arrow className="rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Dates suivantes"
                  disabled={shift(windowStart, WINDOW_DAYS) > lastDay || loading}
                  onClick={() => setWindowStart((w) => shift(w, WINDOW_DAYS))}
                  className="flex h-11 w-11 items-center justify-center border border-ivoire/15 transition-colors hover:border-champagne disabled:opacity-25"
                >
                  <Arrow />
                </button>
              </div>
            </div>

            <div className="-mx-5 mt-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0">
              <div className="flex gap-2 md:grid md:grid-cols-7" role="listbox" aria-label="Jours">
                {(days ?? Array.from({ length: WINDOW_DAYS }, (_, i) => ({ date: shift(windowStart, i), slots: [], isOpen: true, weekday: 0, skeleton: true }))).map((d) => {
                  const available = d.slots.length > 0;
                  const active = d.date === date;
                  const skeleton = "skeleton" in d;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!available}
                      onClick={() => {
                        setDate(d.date);
                        setSlot(null);
                      }}
                      className={`flex min-w-[4.25rem] flex-col items-center gap-1 border px-2 py-4 transition-all duration-300 md:min-w-0 ${
                        active
                          ? "border-ivoire bg-ivoire text-noir"
                          : available
                            ? "border-ivoire/15 hover:border-champagne"
                            : "border-ivoire/5 text-ivoire/25"
                      } ${skeleton ? "animate-pulse" : ""}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{format(parseISO(d.date), "EEE", { locale: fr }).replace(".", "")}</span>
                      <span className="font-serif text-2xl leading-none">{format(parseISO(d.date), "d")}</span>
                      <span className={`h-1 w-1 rounded-full ${available ? (active ? "bg-noir" : "bg-champagne") : "bg-transparent"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 min-h-[12rem]" aria-live="polite">
              {loading && <p className="text-sm text-ivoire/50">Recherche des disponibilités…</p>}
              {!loading && days && !days.some((d) => d.slots.length) && (
                <div className="text-ivoire/70">
                  <p>Aucun créneau disponible sur ces dates.</p>
                  {shift(windowStart, WINDOW_DAYS) <= lastDay && (
                    <button type="button" onClick={() => setWindowStart((w) => shift(w, WINDOW_DAYS))} className="mt-4 inline-flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-champagne">
                      Voir les dates suivantes <Arrow />
                    </button>
                  )}
                </div>
              )}
              {!loading && selectedDay && (
                <>
                  <p className="font-serif text-2xl first-letter:uppercase">{longDate(selectedDay.date)}</p>
                  <div className="mt-6 space-y-8">
                    {groups.map((g) => (
                      <div key={g.label}>
                        <p className="label text-ivoire/50">{g.label}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                          {g.slots.map((s) => (
                            <button
                              key={s.start}
                              type="button"
                              aria-pressed={slot?.start === s.start}
                              onClick={() => setSlot(s)}
                              className={`border py-3.5 text-sm font-medium tabular-nums transition-all duration-300 ${
                                slot?.start === s.start ? "border-ivoire bg-ivoire text-noir" : "border-ivoire/15 hover:border-champagne"
                              }`}
                            >
                              {s.label.replace(":", "h")}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {step === "details" && service && slot && (
          <section aria-labelledby="step-title" className="mt-10 animate-rise">
            <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(2.4rem,7vw,3.75rem)] leading-none outline-none">
              Vos coordonnées
            </h1>
            <form id="booking-form" onSubmit={submit} className="mt-10 grid gap-6 sm:grid-cols-2" noValidate>
              <Field label="Prénom" name="firstName" autoComplete="given-name" error={fieldErrors.firstName} required />
              <Field label="Nom" name="lastName" autoComplete="family-name" error={fieldErrors.lastName} required />
              <Field label="Téléphone" name="phone" type="tel" inputMode="tel" autoComplete="tel" error={fieldErrors.phone} required placeholder="06 12 34 56 78" />
              <Field label="Email (facultatif)" name="email" type="email" autoComplete="email" error={fieldErrors.email} hint="Pour recevoir la confirmation et un rappel." />
              <div className="sm:col-span-2">
                <label htmlFor="note" className="field-label">Précision pour le barbier (facultatif)</label>
                <textarea id="note" name="note" rows={3} maxLength={500} className="field resize-none" />
              </div>
              {/* Champ piège pour les robots : invisible pour les visiteurs */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="website">Site web</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <label className="flex items-start gap-4 text-sm leading-relaxed text-ivoire/70 sm:col-span-2">
                <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4 shrink-0 accent-[#B8AD99]" />
                <span>
                  J&apos;ai pris connaissance de la{" "}
                  <Link href="/confidentialite" target="_blank" className="text-ivoire underline decoration-champagne underline-offset-4">
                    politique de confidentialité
                  </Link>
                  . Mes données servent uniquement à la gestion de mon rendez-vous.
                </span>
              </label>
              {fieldErrors.privacyAccepted && <p className="text-sm text-champagne sm:col-span-2">{fieldErrors.privacyAccepted}</p>}
            </form>
          </section>
        )}
      </div>

      {/* Récapitulatif : colonne sur ordinateur, barre fixe sur mobile */}
      <aside className="md:col-span-4">
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ivoire/10 bg-noir/95 px-5 pt-4 backdrop-blur-md md:sticky md:top-32 md:border md:bg-noir-soft md:p-8" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <p className="label hidden md:block">Votre rendez-vous</p>
          <dl className="flex items-center justify-between gap-4 text-sm md:mt-6 md:block md:space-y-5">
            <div className="min-w-0">
              <dt className="hidden text-[11px] uppercase tracking-[0.18em] text-ivoire/45 md:block">Prestation</dt>
              <dd className="truncate font-serif text-xl md:mt-1 md:text-2xl">{service?.name ?? "—"}</dd>
            </div>
            <div className="hidden md:block">
              <dt className="text-[11px] uppercase tracking-[0.18em] text-ivoire/45">Date</dt>
              <dd className="mt-1 first-letter:uppercase">{slot && date ? `${longDate(date)} · ${slot.label.replace(":", "h")}` : "—"}</dd>
            </div>
            <div className="shrink-0 text-right md:text-left">
              <dt className="hidden text-[11px] uppercase tracking-[0.18em] text-ivoire/45 md:block">Tarif</dt>
              <dd className="tabular-nums md:mt-1">
                {service ? formatPrice(service.price_cents) : "—"}
                {service && <span className="ml-2 text-ivoire/45">· {formatDuration(service.duration_minutes ?? 0)}</span>}
              </dd>
            </div>
          </dl>
          {slot && date && <p className="mt-1 text-xs text-ivoire/60 first-letter:uppercase md:hidden">{`${longDate(date)} · ${slot.label.replace(":", "h")}`}</p>}

          <div className="mt-4 md:mt-8">
            {step === "service" && (
              <Button type="button" className="w-full" disabled>
                Choisissez une prestation
              </Button>
            )}
            {step === "slot" && (
              <Button type="button" className="w-full" disabled={!slot} onClick={() => setStep("details")}>
                Continuer <Arrow />
              </Button>
            )}
            {step === "details" && (
              <Button type="submit" form="booking-form" className="w-full" disabled={submitting}>
                {submitting ? "Confirmation…" : "Confirmer le rendez-vous"}
              </Button>
            )}
          </div>
          {salonPhone && (
            <p className="mt-6 hidden text-xs leading-relaxed text-ivoire/45 md:block">
              Une question ? <a href={`tel:${salonPhone.replace(/\s/g, "")}`} className="text-ivoire/80 hover:text-champagne">{salonPhone}</a>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, name, error, hint, ...props }: React.ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: string }) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="field-label">{label}</label>
      <input id={name} name={name} className={`field ${error ? "border-champagne" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${name}-error`} className="mt-2 text-sm text-champagne">{error}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-2 text-xs text-ivoire/45">{hint}</p>
      ) : null}
    </div>
  );
}
