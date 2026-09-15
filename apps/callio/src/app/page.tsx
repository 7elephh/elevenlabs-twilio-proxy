import Link from "next/link";

/**
 * Emplacement reserve au site commercial.
 *
 * Le site public de Callio ne figure pas dans ce depot : cette page tient sa
 * place a la racine pour que l'application privee puisse etre developpee sans
 * occuper l'URL du marketing. Elle est volontairement minimale et ne pretend
 * pas etre la landing page : deposer le vrai site ici le remplacera.
 */
export default function RootPlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-16">
      <p className="cal-eyebrow">Callio</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-mist-100 sm:text-3xl">
        Emplacement réservé au site public
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-mist-500">
        Cette page n&apos;est pas la landing page Callio. Elle occupe la route{" "}
        <code className="rounded bg-night-800 px-1.5 py-0.5 text-mist-300">/</code> pour
        que l&apos;application privée puisse être développée sans empiéter sur le
        parcours marketing. Le site commercial viendra la remplacer ici, sans
        modification de l&apos;espace privé.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/app/dashboard" className="cal-button">
          Ouvrir l&apos;espace Callio
        </Link>
        <Link href="/login" className="cal-button-ghost">
          Se connecter
        </Link>
      </div>

      <p className="mt-10 text-xs text-mist-600">
        Espace privé : <code className="text-mist-500">/app</code> — tableau de bord,
        prospects, appels, rendez-vous et réglages.
      </p>
    </main>
  );
}
