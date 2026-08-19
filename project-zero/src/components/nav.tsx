"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", short: "Home" },
  { href: "/sessions", label: "Sessions", short: "Sessions" },
  { href: "/tests", label: "Tests", short: "Tests" },
  { href: "/progress", label: "Progress", short: "Progress" },
  { href: "/checkpoints", label: "Checkpoints", short: "Points" },
  { href: "/profile", label: "Profile", short: "Profile" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            isActive(pathname, link.href)
              ? "bg-ink-800 text-chalk-100"
              : "text-chalk-600 hover:text-chalk-300"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {LINKS.map((link) => (
          <li key={link.href} className="flex-1">
            <Link
              href={link.href}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 pb-[env(safe-area-inset-bottom)] text-[10px] font-medium uppercase tracking-wide transition ${
                isActive(pathname, link.href) ? "text-signal" : "text-chalk-600"
              }`}
            >
              <span
                className={`h-1 w-6 rounded-full ${
                  isActive(pathname, link.href) ? "bg-signal" : "bg-transparent"
                }`}
              />
              {link.short}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
