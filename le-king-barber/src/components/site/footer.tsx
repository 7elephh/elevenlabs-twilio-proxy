import Link from "next/link";

import type { BusinessSettings } from "@/lib/types";

import { Logotype } from "./logo";

export function Footer({ settings }: { settings: BusinessSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ivoire/10 bg-noir">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1fr_auto] md:items-end md:px-10 md:py-20">
        <div>
          <Logotype className="h-auto w-40 opacity-90" />
        </div>
        <nav aria-label="Liens légaux" className="flex flex-wrap gap-x-8 gap-y-3 text-[12px] uppercase tracking-[0.18em] text-ivoire/55">
          <Link href="/reserver" className="hover:text-ivoire">Réserver</Link>
          {settings.instagram_url && (
            <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-ivoire">Instagram</a>
          )}
          <Link href="/mentions-legales" className="hover:text-ivoire">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-ivoire">Confidentialité</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-10 text-[11px] tracking-[0.12em] text-ivoire/35 md:px-10" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
        © {year} {settings.salon_name}
      </div>
    </footer>
  );
}
