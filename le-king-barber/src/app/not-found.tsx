import Link from "next/link";

import { Monogram } from "@/components/site/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-5 text-center">
      <Monogram className="w-16 opacity-80" />
      <h1 className="mt-10 text-5xl">Page introuvable</h1>
      <p className="mt-4 text-ivoire/60">Le lien est peut-être expiré ou incorrect.</p>
      <Link href="/" className="mt-10 text-[12px] font-semibold uppercase tracking-[0.22em] text-champagne hover:text-ivoire">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
