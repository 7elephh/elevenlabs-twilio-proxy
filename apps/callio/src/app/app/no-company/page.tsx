import { Card, PageHeader } from "@/components/ui";

/**
 * Atterrissage d'un compte authentifie sans aucune appartenance.
 *
 * L'onboarding autonome n'est pas construit a ce stade : cette page dit
 * honnetement ce qu'il manque au lieu d'offrir un bouton sans effet.
 */
export default function NoCompanyPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <PageHeader
        title="Aucune entreprise associée"
        subtitle="Votre compte est authentifié, mais il n'est rattaché à aucune entreprise."
      />
      <Card>
        <p className="text-sm leading-relaxed text-mist-300">
          L&apos;accès aux données passe par une ligne dans{" "}
          <code className="rounded bg-night-800 px-1.5 py-0.5 text-mist-300">
            company_members
          </code>
          . Tant qu&apos;elle n&apos;existe pas, aucune donnée n&apos;est visible — c&apos;est
          le comportement attendu de l&apos;isolation multi-entreprises.
        </p>
        <p className="mt-4 text-sm text-mist-500">
          Demandez à un propriétaire ou à un administrateur de votre entreprise de vous
          ajouter à l&apos;équipe.
        </p>
      </Card>
    </main>
  );
}
