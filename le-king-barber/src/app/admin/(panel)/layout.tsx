import type { Metadata } from "next";
import Link from "next/link";

import { BottomNav, SideNav } from "@/components/admin/nav";
import { Monogram } from "@/components/site/logo";
import { requireAdmin } from "@/lib/auth";

import { signOutAction } from "../login/actions";

export const metadata: Metadata = { title: "Espace salon", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-[100svh] md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-[100svh] flex-col justify-between border-r border-ivoire/10 p-5 md:flex">
        <div>
          <Link href="/admin" className="mb-10 flex items-center gap-3 px-3">
            <Monogram className="w-8" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivoire/70">Espace salon</span>
          </Link>
          <SideNav />
        </div>
        <div className="space-y-3 px-3 text-xs text-ivoire/40">
          <p className="truncate">{user.email}</p>
          <div className="flex gap-4">
            <Link href="/" target="_blank" className="hover:text-ivoire">Voir le site</Link>
            <form action={signOutAction}>
              <button className="hover:text-ivoire">Déconnexion</button>
            </form>
          </div>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-ivoire/10 px-5 py-3 md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <Link href="/admin" className="flex items-center gap-3">
          <Monogram className="w-7" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivoire/70">Espace salon</span>
        </Link>
        <form action={signOutAction}>
          <button className="text-xs text-ivoire/50">Déconnexion</button>
        </form>
      </header>

      <main className="min-w-0 px-5 pb-28 pt-8 md:px-10 md:pb-16 md:pt-12">{children}</main>
      <BottomNav />
    </div>
  );
}
