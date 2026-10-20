"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV = [
  { href: "/admin", label: "Tableau de bord", short: "Accueil", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/admin/agenda", label: "Agenda", short: "Agenda", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/admin/rendez-vous", label: "Rendez-vous", short: "RDV", icon: "M5 5h14M5 12h14M5 19h9" },
  { href: "/admin/clients", label: "Clients", short: "Clients", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
  { href: "/admin/disponibilites", label: "Horaires & congés", short: "Horaires", icon: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/admin/prestations", label: "Prestations", short: "Tarifs", icon: "M6 3l12 18M18 3L6 21M4 8h4M16 16h4" },
  { href: "/admin/site", label: "Contenus du site", short: "Site", icon: "M3 5h18v14H3zM3 9h18" },
  { href: "/admin/integrations", label: "Intégrations", short: "Réglages", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex flex-col gap-1">
      {ADMIN_NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={isActive(pathname, n.href) ? "page" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
            isActive(pathname, n.href) ? "bg-ivoire/[0.07] text-ivoire" : "text-ivoire/55 hover:text-ivoire"
          }`}
        >
          <Icon d={n.icon} />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

const MOBILE = ["/admin", "/admin/agenda", "/admin/rendez-vous", "/admin/clients", "/admin/disponibilites"];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-ivoire/10 bg-noir/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {ADMIN_NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
        <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${isActive(pathname, n.href) ? "text-champagne" : "text-ivoire/55"}`}>
          <Icon d={n.icon} />
          {n.short}
        </Link>
      ))}
      <details className="group relative">
        <summary className="flex cursor-pointer list-none flex-col items-center gap-1 py-2.5 text-[10px] text-ivoire/55">
          <Icon d="M5 12h.01M12 12h.01M19 12h.01" />
          Plus
        </summary>
        <div className="absolute bottom-full right-2 mb-2 w-56 border border-ivoire/10 bg-noir-soft p-2">
          {ADMIN_NAV.filter((n) => !MOBILE.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-3 text-sm text-ivoire/80">
              <Icon d={n.icon} />
              {n.label}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}
