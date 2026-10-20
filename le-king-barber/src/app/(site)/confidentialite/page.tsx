import type { Metadata } from "next";

import { LegalPage, Missing } from "@/components/site/prose";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = { title: "Politique de confidentialité", alternates: { canonical: "/confidentialite" } };
export const revalidate = 300;

export default async function Confidentialite() {
  const { settings: s } = await getSiteData();
  return (
    <LegalPage title="Confidentialité">
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          <Missing value={s.legal_name ?? s.salon_name} />, <Missing value={s.legal_address} />. Contact : <Missing value={s.email ?? s.phone} />.
        </p>
      </section>
      <section>
        <h2>Données collectées</h2>
        <p>Lors d&apos;une réservation, nous collectons uniquement :</p>
        <ul>
          <li>vos prénom et nom ;</li>
          <li>votre numéro de téléphone ;</li>
          <li>votre adresse email, si vous choisissez de la fournir ;</li>
          <li>la prestation, la date et l&apos;heure choisies, et une éventuelle précision laissée au barbier.</li>
        </ul>
        <p>Une empreinte non réversible de votre adresse IP est conservée 24 heures pour prévenir les réservations abusives.</p>
      </section>
      <section>
        <h2>Finalités et base légale</h2>
        <p>
          Ces données servent exclusivement à gérer votre rendez-vous (confirmation, rappel, modification ou annulation). Le traitement repose sur
          l&apos;exécution de la prestation que vous demandez (article 6.1.b du RGPD). Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires.
        </p>
      </section>
      <section>
        <h2>Destinataires et sous-traitants</h2>
        <ul>
          <li>Supabase (hébergement de la base de données) ;</li>
          <li>Vercel (hébergement du site) ;</li>
          <li>Resend (envoi des emails transactionnels), uniquement si vous fournissez un email ;</li>
          <li>Google Calendar, si le salon a activé la synchronisation de son agenda.</li>
        </ul>
      </section>
      <section>
        <h2>Durée de conservation</h2>
        <p>
          Vos données sont conservées {s.data_retention_months} mois après votre dernier rendez-vous, puis anonymisées automatiquement. Vous pouvez à tout
          moment demander leur suppression.
        </p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation et d&apos;opposition. Pour l&apos;exercer, contactez le salon :{" "}
          <Missing value={s.email ?? s.phone} />. Vous pouvez également introduire une réclamation auprès de la CNIL (cnil.fr).
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          Le site public n&apos;utilise aucun cookie publicitaire ni outil de mesure d&apos;audience. Seul l&apos;espace d&apos;administration utilise des
          cookies strictement nécessaires à l&apos;authentification.
        </p>
      </section>
    </LegalPage>
  );
}
