import type { Metadata } from "next";

import { LegalPage, Missing } from "@/components/site/prose";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };
export const revalidate = 300;

export default async function MentionsLegales() {
  const { settings: s } = await getSiteData();
  return (
    <LegalPage title="Mentions légales">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          <Missing value={s.legal_name ?? s.salon_name} /> — <Missing value={s.legal_form} />
          <br />
          SIRET : <Missing value={s.siret} />
          <br />
          Adresse : <Missing value={s.legal_address} />
          <br />
          Téléphone : <Missing value={s.phone} /> · Email : <Missing value={s.email} />
          <br />
          Directeur de la publication : <Missing value={s.publication_director} />
        </p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          <Missing value={s.hosting_provider} />
          <br />
          Base de données : Supabase Inc. — région d&apos;hébergement choisie lors de la création du projet.
        </p>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>Le logo, les textes et les photographies de ce site sont la propriété de leurs auteurs respectifs. Toute reproduction sans autorisation est interdite.</p>
      </section>
    </LegalPage>
  );
}
