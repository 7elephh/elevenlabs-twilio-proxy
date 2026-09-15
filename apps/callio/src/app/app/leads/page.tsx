import Link from "next/link";

import { LeadDrawer } from "@/components/lead-drawer";
import { Badge, EmptyState, PageHeader, Td, Th, TableWrap } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  REQUEST_TYPE_LABELS,
} from "@/lib/domain/labels";
import { maskPhone } from "@/lib/domain/phone";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { company, repository } = await requireSession();
  const params = await searchParams;
  const leads = await repository.listLeads(company.id);

  // La fiche est chargee par son identifiant et portee par l'URL : elle reste
  // partageable et survit a un rechargement.
  const selected = params.lead
    ? await repository.getLead(company.id, params.lead)
    : null;

  return (
    <>
      <PageHeader
        title="Prospects"
        subtitle={`${leads.length} prospect${leads.length > 1 ? "s" : ""} · numéros masqués dans la liste`}
      />

      {leads.length === 0 ? (
        <EmptyState
          title="Aucun prospect"
          body="Les demandes de devis et les appels manqués apparaîtront ici dès que l'ingestion sera branchée."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Nom</Th>
              <Th>Téléphone</Th>
              <Th>Demande</Th>
              <Th>Source</Th>
              <Th>Statut</Th>
              <Th>Reçu le</Th>
              <Th>Prochaine action</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-night-850/60">
                <Td>
                  <Link
                    href={`/app/leads?lead=${lead.id}`}
                    className="font-medium text-mist-100 hover:text-callio-300"
                  >
                    {lead.fullName}
                  </Link>
                  {lead.city ? (
                    <span className="block text-xs text-mist-600">{lead.city}</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap font-mono text-xs text-mist-400">
                  {maskPhone(lead.phone)}
                </Td>
                <Td className="text-mist-300">{REQUEST_TYPE_LABELS[lead.requestType]}</Td>
                <Td className="text-mist-400">{LEAD_SOURCE_LABELS[lead.source]}</Td>
                <Td>
                  <Badge tone={LEAD_STATUS_TONES[lead.status]}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-xs text-mist-500">
                  {formatDateTime(lead.createdAt)}
                </Td>
                <Td className="text-xs text-mist-400">{lead.nextAction ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {selected ? <LeadDrawer lead={selected} /> : null}
    </>
  );
}
