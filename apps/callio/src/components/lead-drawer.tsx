import Link from "next/link";

import { Badge, PendingIntegration } from "@/components/ui";
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_TONES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  REQUEST_TYPE_LABELS,
  URGENCY_LABELS,
  URGENCY_TONES,
} from "@/lib/domain/labels";
import { formatPhone } from "@/lib/domain/phone";
import type { LeadDetail } from "@/lib/domain/types";
import { formatDateTime, formatDuration } from "@/lib/format";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="cal-eyebrow">{label}</p>
      {/* break-words : une adresse e-mail longue se coupe au lieu de deborder. */}
      <div className="mt-1 break-words text-sm text-mist-200">{children}</div>
    </div>
  );
}

/**
 * Fiche detaillee d'un prospect.
 *
 * Rendue cote serveur, pilotee par le parametre d'URL `?lead=` : la fiche est
 * donc partageable, rechargeable et fonctionne sans JavaScript. Le numero y
 * apparait en clair, contrairement a la liste, car l'utilisateur a
 * explicitement ouvert ce dossier.
 */
export function LeadDrawer({ lead }: { lead: LeadDetail }) {
  return (
    <>
      {/* Voile : un lien, donc fermable au clavier et sans JavaScript. */}
      <Link
        href="/app/leads"
        aria-label="Fermer la fiche"
        className="fixed inset-0 z-30 bg-night-950/70 backdrop-blur-sm"
      />

      <aside
        aria-label={`Fiche de ${lead.fullName}`}
        className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-card border-t border-night-700 bg-night-900 p-5
                   sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:border-l sm:border-t-0"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-mist-100">
              {lead.fullName}
            </h2>
            <p className="mt-1 text-sm text-mist-500">
              {[lead.city, lead.postalCode].filter(Boolean).join(" · ") ||
                "Localisation non renseignée"}
            </p>
          </div>
          <Link
            href="/app/leads"
            className="cal-button-ghost min-h-[36px] shrink-0 px-3 text-xs"
          >
            Fermer
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <Badge tone={LEAD_STATUS_TONES[lead.status]}>
            {LEAD_STATUS_LABELS[lead.status]}
          </Badge>
          <Badge tone={URGENCY_TONES[lead.urgency]}>
            Urgence : {URGENCY_LABELS[lead.urgency]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Téléphone">
            <a href={`tel:${lead.phone}`} className="text-callio-300 hover:text-callio-200">
              {formatPhone(lead.phone)}
            </a>
          </Field>
          <Field label="E-mail">{lead.email ?? "—"}</Field>
          <Field label="Demande">{REQUEST_TYPE_LABELS[lead.requestType]}</Field>
          <Field label="Source">{LEAD_SOURCE_LABELS[lead.source]}</Field>
          <Field label="Reçu le">{formatDateTime(lead.createdAt)}</Field>
          <Field label="Prise en charge">
            {lead.firstHandledAt ? formatDateTime(lead.firstHandledAt) : "Pas encore"}
          </Field>
        </div>

        <div className="mt-5 border-t border-night-800 pt-5">
          <Field label="Prochaine action">
            {lead.nextAction ? (
              <>
                {lead.nextAction}
                {lead.nextActionAt ? (
                  <span className="block text-xs text-mist-600">
                    {formatDateTime(lead.nextActionAt)}
                  </span>
                ) : null}
              </>
            ) : (
              "—"
            )}
          </Field>
        </div>

        {lead.notes ? (
          <div className="mt-5 border-t border-night-800 pt-5">
            <Field label="Notes">{lead.notes}</Field>
          </div>
        ) : null}

        {/* Consentement : piece justificative, presentee telle quelle. */}
        <div className="mt-5 border-t border-night-800 pt-5">
          <p className="cal-eyebrow">Consentement téléphonique</p>
          {lead.consent ? (
            <div className="mt-2 rounded-control border border-night-700 bg-night-850 p-3">
              <Badge tone={lead.consent.granted ? "positive" : "negative"}>
                {lead.consent.granted ? "Accordé" : "Refusé"}
              </Badge>
              <p className="mt-2 text-xs leading-relaxed text-mist-400">
                « {lead.consent.statementShown} »
              </p>
              <p className="mt-2 text-[11px] text-mist-600">
                Recueilli le {formatDateTime(lead.consent.collectedAt)} · source :{" "}
                {lead.consent.evidenceSource || "non précisée"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-warn">
              Aucune preuve de consentement enregistrée pour ce prospect.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-night-800 pt-5">
          <p className="cal-eyebrow">Appels ({lead.calls.length})</p>
          {lead.calls.length === 0 ? (
            <p className="mt-2 text-sm text-mist-600">Aucun appel enregistré.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {lead.calls.map((call) => (
                <li
                  key={call.id}
                  className="rounded-control border border-night-700 bg-night-850 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={CALL_OUTCOME_TONES[call.outcome]}>
                      {CALL_OUTCOME_LABELS[call.outcome]}
                    </Badge>
                    <span className="text-[11px] text-mist-600">
                      {formatDateTime(call.startedAt)} · {formatDuration(call.durationSeconds)}
                    </span>
                  </div>
                  {call.summary ? (
                    <p className="mt-2 text-xs leading-relaxed text-mist-400">
                      {call.summary}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 border-t border-night-800 pt-5">
          <p className="cal-eyebrow">Rendez-vous ({lead.appointments.length})</p>
          {lead.appointments.length === 0 ? (
            <p className="mt-2 text-sm text-mist-600">Aucun rendez-vous.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {lead.appointments.map((appt) => (
                <li
                  key={appt.id}
                  className="flex items-center justify-between gap-2 rounded-control border border-night-700 bg-night-850 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-mist-200">
                      {appt.service}
                    </span>
                    <span className="block text-[11px] text-mist-600">
                      {formatDateTime(appt.scheduledAt)}
                      {appt.assigneeName ? ` · ${appt.assigneeName}` : ""}
                    </span>
                  </span>
                  <Badge tone={APPOINTMENT_STATUS_TONES[appt.status]}>
                    {APPOINTMENT_STATUS_LABELS[appt.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <PendingIntegration>
          Le déclenchement d&apos;un appel depuis cette fiche arrivera avec l&apos;intégration
          du fournisseur de voix. Aucun bouton d&apos;appel n&apos;est affiché tant que
          l&apos;action serait sans effet.
        </PendingIntegration>
      </aside>
    </>
  );
}
