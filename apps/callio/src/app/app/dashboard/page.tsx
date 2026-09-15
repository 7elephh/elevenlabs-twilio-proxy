import Link from "next/link";

import { Badge, Card, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from "@/lib/domain/labels";
import {
  buildRecentActivity,
  computeDashboardMetrics,
  formatDelay,
  lastDays,
} from "@/lib/domain/metrics";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS: Record<"lead" | "call" | "appointment", string> = {
  lead: "Prospect",
  call: "Appel",
  appointment: "RDV",
};

export default async function DashboardPage() {
  const { company, repository } = await requireSession();

  const [leads, calls, appointments] = await Promise.all([
    repository.listLeads(company.id),
    repository.listCalls(company.id),
    repository.listAppointments(company.id),
  ]);

  const period = lastDays(30);
  const metrics = computeDashboardMetrics(leads, calls, appointments, period);
  const activity = buildRecentActivity(leads, calls, appointments, 8);

  const needsAttention = leads
    .filter((l) => l.status === "new" || l.status === "contacting")
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Activité des 30 derniers jours"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Nouveaux prospects" value={metrics.newLeads} />
        <StatTile label="Appels traités" value={metrics.handledCalls} />
        <StatTile label="Prospects qualifiés" value={metrics.qualifiedLeads} />
        <StatTile label="Rendez-vous pris" value={metrics.appointmentsSet} />
        <StatTile label="Appels transférés" value={metrics.transferredCalls} />
        <StatTile
          label="Délai moyen de prise en charge"
          value={formatDelay(metrics.averageHandlingDelayMinutes)}
          sub={
            metrics.handlingDelaySampleSize === 0
              ? "Aucune prise en charge mesurée"
              : `Sur ${metrics.handlingDelaySampleSize} prospect${
                  metrics.handlingDelaySampleSize > 1 ? "s" : ""
                }`
          }
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0">
          <SectionTitle
            title="À traiter"
            hint="Prospects encore sans issue"
            action={
              <Link href="/app/leads" className="text-xs text-callio-400 hover:text-callio-200">
                Tout voir
              </Link>
            }
          />
          {needsAttention.length === 0 ? (
            <p className="py-6 text-center text-sm text-mist-500">
              Aucun prospect en attente.
            </p>
          ) : (
            <ul className="divide-y divide-night-800">
              {needsAttention.map((lead) => (
                <li key={lead.id} className="py-2.5">
                  <Link
                    href={`/app/leads?lead=${lead.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-mist-100">
                        {lead.fullName}
                      </span>
                      <span className="block truncate text-xs text-mist-600">
                        {lead.nextAction ?? "Aucune action définie"}
                      </span>
                    </span>
                    <Badge tone={LEAD_STATUS_TONES[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <SectionTitle title="Activité récente" />
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-mist-500">Aucune activité.</p>
          ) : (
            <ul className="divide-y divide-night-800">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 shrink-0">
                    <Badge tone={item.kind === "call" ? "accent" : "neutral"}>
                      {ACTIVITY_ICONS[item.kind]}
                    </Badge>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-mist-200">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-mist-600">
                      {item.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-mist-600">
                    {formatRelative(item.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
