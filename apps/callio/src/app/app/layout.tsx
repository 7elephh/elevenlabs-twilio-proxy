import Link from "next/link";

import { BottomNav, SideNav } from "@/components/app-nav";
import { CompanySwitcher } from "@/components/company-switcher";
import { Badge } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/domain/roles";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      {/* Bandeau permanent : impossible de confondre demonstration et reel. */}
      {session.source === "demo" ? (
        <div className="border-b border-callio-700/50 bg-callio-700/20 px-4 py-2 text-center text-xs text-callio-200">
          Données de démonstration — espace fictif ClimaNova. Aucune donnée réelle
          n&apos;est affichée.
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pb-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/app/dashboard" className="text-base font-semibold tracking-tight">
              Callio
            </Link>
            <span aria-hidden="true" className="text-night-600">
              /
            </span>
            <span className="text-sm text-mist-300">{session.company.name}</span>
            {session.company.status === "suspended" ? (
              <Badge tone="negative">Suspendue</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <CompanySwitcher
              companies={session.companies}
              activeId={session.company.id}
            />
            <span className="hidden text-xs text-mist-600 sm:inline">
              {session.user.email} · {ROLE_LABELS[session.role]}
            </span>
          </div>
        </header>

        <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8">
          <aside className="md:sticky md:top-5 md:self-start">
            <SideNav />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
