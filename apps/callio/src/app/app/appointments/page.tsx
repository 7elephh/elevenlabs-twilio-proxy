import Link from "next/link";

import { Badge, EmptyState, PageHeader, Td, Th, TableWrap } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
} from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const { company, repository } = await requireSession();

  const [appointments, leads] = await Promise.all([
    repository.listAppointments(company.id),
    repository.listLeads(company.id),
  ]);

  const leadName = new Map(leads.map((l) => [l.id, l.fullName]));

  return (
    <>
      <PageHeader
        title="Rendez-vous"
        subtitle={`${appointments.length} rendez-vous`}
      />

      {appointments.length === 0 ? (
        <EmptyState
          title="Aucun rendez-vous"
          body="Les créneaux réservés apparaîtront ici une fois l'agenda connecté."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Prospect</Th>
              <Th>Prestation</Th>
              <Th>Intervenant</Th>
              <Th>Date</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id} className="transition-colors hover:bg-night-850/60">
                <Td>
                  <Link
                    href={`/app/leads?lead=${appt.leadId}`}
                    className="font-medium text-mist-100 hover:text-callio-300"
                  >
                    {leadName.get(appt.leadId) ?? "Prospect inconnu"}
                  </Link>
                </Td>
                <Td className="text-mist-300">{appt.service || "—"}</Td>
                <Td className="text-mist-400">
                  {appt.assigneeName ?? (
                    <span className="text-mist-600">Non affecté</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs text-mist-500">
                  {formatDateTime(appt.scheduledAt)}
                  <span className="block text-mist-600">{appt.durationMinutes} min</span>
                </Td>
                <Td>
                  <Badge tone={APPOINTMENT_STATUS_TONES[appt.status]}>
                    {APPOINTMENT_STATUS_LABELS[appt.status]}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
