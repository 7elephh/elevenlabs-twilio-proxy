import Link from "next/link";

import { Badge, EmptyState, PageHeader, Td, Th, TableWrap } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import {
  CALL_DIRECTION_LABELS,
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_TONES,
  URGENCY_LABELS,
  URGENCY_TONES,
} from "@/lib/domain/labels";
import { formatDateTime, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const { company, repository } = await requireSession();

  const [calls, leads] = await Promise.all([
    repository.listCalls(company.id),
    repository.listLeads(company.id),
  ]);

  const leadName = new Map(leads.map((l) => [l.id, l.fullName]));

  return (
    <>
      <PageHeader
        title="Appels"
        subtitle={`${calls.length} appel${calls.length > 1 ? "s" : ""} enregistré${calls.length > 1 ? "s" : ""}`}
      />

      {calls.length === 0 ? (
        <EmptyState
          title="Aucun appel"
          body="Les appels traités par l'agent apparaîtront ici une fois le fournisseur de voix connecté."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Prospect</Th>
              <Th>Sens</Th>
              <Th>Date</Th>
              <Th>Durée</Th>
              <Th>Résultat</Th>
              <Th>Urgence</Th>
              <Th className="min-w-[18rem]">Résumé</Th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="transition-colors hover:bg-night-850/60">
                <Td>
                  {call.leadId ? (
                    <Link
                      href={`/app/leads?lead=${call.leadId}`}
                      className="font-medium text-mist-100 hover:text-callio-300"
                    >
                      {leadName.get(call.leadId) ?? "Prospect inconnu"}
                    </Link>
                  ) : (
                    <span className="text-mist-600">Non rattaché</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-mist-400">
                  {CALL_DIRECTION_LABELS[call.direction]}
                </Td>
                <Td className="whitespace-nowrap text-xs text-mist-500">
                  {formatDateTime(call.startedAt)}
                </Td>
                <Td className="whitespace-nowrap tabular-nums text-mist-400">
                  {formatDuration(call.durationSeconds)}
                </Td>
                <Td>
                  <Badge tone={CALL_OUTCOME_TONES[call.outcome]}>
                    {CALL_OUTCOME_LABELS[call.outcome]}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={URGENCY_TONES[call.urgency]}>
                    {URGENCY_LABELS[call.urgency]}
                  </Badge>
                </Td>
                <Td className="text-xs leading-relaxed text-mist-400">
                  {call.summary ?? "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
