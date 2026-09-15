"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app/dashboard", label: "Tableau de bord", short: "Bord" },
  { href: "/app/leads", label: "Prospects", short: "Prospects" },
  { href: "/app/calls", label: "Appels", short: "Appels" },
  { href: "/app/appointments", label: "Rendez-vous", short: "RDV" },
  { href: "/app/settings", label: "Réglages", short: "Réglages" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation laterale sur desktop. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="space-y-1">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-control px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-callio-700/25 font-medium text-callio-200"
                    : "text-mist-500 hover:bg-night-800 hover:text-mist-300"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre d'onglets fixe en bas sur mobile. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-night-700 bg-night-900/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center px-1 text-[11px] font-medium transition-colors ${
                  active ? "text-callio-400" : "text-mist-600"
                }`}
              >
                {link.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
