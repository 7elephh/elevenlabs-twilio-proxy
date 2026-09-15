import { Chips, KeyValue, SettingsSection } from "@/components/settings/section";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import {
  INTEGRATION_STATUS_LABELS,
  INTEGRATION_STATUS_TONES,
  URGENCY_LABELS,
} from "@/lib/domain/labels";
import { formatPhone } from "@/lib/domain/phone";
import { can, ROLE_LABELS } from "@/lib/domain/roles";
import type { IntegrationKind } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const WEEKDAY_NAMES = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

const INTEGRATION_KIND_LABELS: Record<IntegrationKind, string> = {
  voice: "Téléphonie",
  calendar: "Agenda",
  sms: "SMS",
};

/**
 * Reglages de l'entreprise.
 *
 * Presentation en lecture a ce stade : l'ecriture suppose des migrations
 * appliquees sur la base, ce qui n'est pas fait. Plutot que d'afficher des
 * formulaires qui n'enregistreraient rien, chaque section montre la
 * configuration reelle et indique ce qui manque pour la rendre modifiable.
 */
export default async function SettingsPage() {
  const { company, repository, role } = await requireSession();

  const [settings, members, integrations] = await Promise.all([
    repository.getAgentSettings(company.id),
    repository.listMembers(company.id),
    repository.listIntegrations(company.id),
  ]);

  const editable = can(role, "settings.write");
  const writeNote = editable
    ? "Édition disponible une fois la couche d'écriture branchée sur Supabase."
    : `Votre rôle (${ROLE_LABELS[role]}) donne un accès en lecture à cette section.`;

  if (!settings) {
    return (
      <>
        <PageHeader title="Réglages" subtitle={company.name} />
        <EmptyState
          title="Aucune configuration d'agent"
          body="Cette entreprise n'a pas encore de ligne dans agent_settings. Elle sera créée à l'activation de Callio."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Réglages"
        subtitle={`${company.name} · dernière mise à jour ${formatDateTime(settings.updatedAt)}`}
      />

      <SettingsSection
        title="Identité de l'entreprise"
        description="Ce que l'agent annonce au téléphone."
        note={writeNote}
      >
        <KeyValue label="Raison sociale" value={company.name} />
        <KeyValue label="Identifiant" value={<code className="text-xs">{company.slug}</code>} />
        <KeyValue label="Fuseau horaire" value={company.timezone} />
        <KeyValue label="Nom de l'agent" value={settings.agentDisplayName} />
      </SettingsSection>

      <SettingsSection
        title="Services"
        description="Prestations que l'agent est autorisé à qualifier."
        note={writeNote}
      >
        <Chips values={settings.services} empty="Aucun service déclaré." />
      </SettingsSection>

      <SettingsSection
        title="Zone d'intervention"
        description="Codes postaux couverts. Hors de cette liste, l'appel est transféré."
        note={
          settings.serviceAreaPostalCodes.length === 0
            ? "Aucune zone déclarée : toutes les demandes sont considérées comme couvertes."
            : writeNote
        }
      >
        <Chips
          values={settings.serviceAreaPostalCodes}
          empty="Aucun code postal déclaré."
        />
      </SettingsSection>

      <SettingsSection
        title="Horaires"
        description="Un jour non déclaré est considéré fermé."
        note={writeNote}
      >
        {WEEKDAY_NAMES.map((name, weekday) => {
          const rule = settings.businessHours.find((h) => h.weekday === weekday);
          return (
            <KeyValue
              key={name}
              label={name}
              value={
                !rule || rule.closed ? (
                  <span className="text-mist-600">Fermé</span>
                ) : (
                  `${rule.opensAt} – ${rule.closesAt}`
                )
              }
            />
          );
        })}
      </SettingsSection>

      <SettingsSection
        title="Équipe"
        description="Les rôles proviennent de company_members : ils font seuls autorité."
        note={
          can(role, "team.manage")
            ? "Invitation et retrait de membres : à brancher avec la couche d'écriture."
            : `Votre rôle (${ROLE_LABELS[role]}) ne permet pas de gérer l'équipe.`
        }
      >
        <ul className="divide-y divide-night-800">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-mist-200">
                  {member.displayName || member.email}
                </span>
                <span className="block truncate text-xs text-mist-600">{member.email}</span>
              </span>
              <Badge tone={member.role === "owner" ? "accent" : "neutral"}>
                {ROLE_LABELS[member.role]}
              </Badge>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        title="Transfert vers un humain"
        description="Numéro et conditions de bascule."
        note={
          settings.transferPhone
            ? writeNote
            : "Aucun numéro de transfert : les règles ci-dessus se déclencheraient sans destination."
        }
      >
        <KeyValue
          label="Numéro de transfert"
          value={
            settings.transferPhone ? (
              formatPhone(settings.transferPhone)
            ) : (
              <span className="text-warn">Non configuré</span>
            )
          }
        />
        <KeyValue
          label="Hors horaires"
          value={settings.transferOutsideHours ? "Transfert" : "Pas de transfert"}
        />
      </SettingsSection>

      <SettingsSection
        title="Règles d'urgence"
        description="Niveaux déclenchant un transfert immédiat."
        note={writeNote}
      >
        <Chips
          values={settings.transferOnUrgency.map((u) => URGENCY_LABELS[u])}
          empty="Aucun niveau ne déclenche de transfert immédiat."
        />
      </SettingsSection>

      <SettingsSection
        title="Questions de qualification"
        description="Posées par l'agent, dans cet ordre."
        note={writeNote}
      >
        {settings.qualificationQuestions.length === 0 ? (
          <p className="text-sm text-mist-600">Aucune question définie.</p>
        ) : (
          <ol className="space-y-2">
            {settings.qualificationQuestions.map((q, index) => (
              <li key={q.id} className="flex gap-3">
                <span className="shrink-0 text-xs tabular-nums text-mist-600">
                  {index + 1}.
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-mist-200">{q.prompt}</span>
                  <span className="block text-xs text-mist-600">
                    <code>{q.answerKey}</code>
                    {q.required ? " · obligatoire" : " · facultative"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </SettingsSection>

      <SettingsSection
        title="Intégrations"
        description="Aucun identifiant n'est stocké ni affiché ici : uniquement l'état de la connexion."
        note="Connexion des fournisseurs (téléphonie, agenda, SMS) : étapes ultérieures du plan."
      >
        <ul className="divide-y divide-night-800">
          {integrations.map((integration) => (
            <li
              key={integration.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block text-sm text-mist-200">
                  {INTEGRATION_KIND_LABELS[integration.kind]}
                </span>
                <span className="block truncate text-xs text-mist-600">
                  {integration.statusMessage ?? integration.provider}
                </span>
              </span>
              <Badge tone={INTEGRATION_STATUS_TONES[integration.status]}>
                {INTEGRATION_STATUS_LABELS[integration.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        title="Activation de Callio"
        description="Interrupteur maître de la prise en charge automatique."
        note={
          can(role, "company.suspend")
            ? "La bascule sera active avec la couche d'écriture : tant qu'elle n'enregistre rien, aucun interrupteur n'est affiché."
            : `Seul un propriétaire peut suspendre l'entreprise. Votre rôle : ${ROLE_LABELS[role]}.`
        }
      >
        <KeyValue
          label="Agent"
          value={
            <Badge tone={settings.enabled ? "positive" : "neutral"}>
              {settings.enabled ? "Actif" : "Inactif"}
            </Badge>
          }
        />
        <KeyValue
          label="Entreprise"
          value={
            <Badge tone={company.status === "active" ? "positive" : "negative"}>
              {company.status === "active" ? "Active" : "Suspendue"}
            </Badge>
          }
        />
      </SettingsSection>
    </>
  );
}
