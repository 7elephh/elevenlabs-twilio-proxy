"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClass } from "@/components/ui/button";

import { Monogram } from "./logo";

const NAV = [
  { href: "/#salon", label: "Le salon" },
  { href: "/#prestations", label: "Prestations" },
  { href: "/#galerie", label: "Galerie", optional: "gallery" },
  { href: "/#infos", label: "Infos pratiques" },
] as const;

export function Header({ hasGallery }: { hasGallery: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV.filter((n) => !("optional" in n) || hasGallery);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ease-lux ${
        scrolled || open ? "border-b border-ivoire/10 bg-noir/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-10">
        <Link href="/" aria-label="Le King Barber — accueil" className="relative z-10 block w-9 md:w-10">
          <Monogram priority />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-10 md:flex">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="text-[12px] font-medium uppercase tracking-[0.2em] text-ivoire/75 transition-colors hover:text-ivoire">
              {n.label}
            </Link>
          ))}
          <Link href="/reserver" className={buttonClass("outline", "px-5 py-3")}>
            Réserver
          </Link>
        </nav>

        <button
          type="button"
          className="relative z-10 -mr-2 flex h-11 w-11 flex-col items-center justify-center gap-[7px] md:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`h-px w-6 bg-ivoire transition-transform duration-500 ${open ? "translate-y-[4px] rotate-45" : ""}`} />
          <span className={`h-px w-6 bg-ivoire transition-transform duration-500 ${open ? "-translate-y-[4px] -rotate-45" : ""}`} />
        </button>
      </div>

      <div
        id="menu-mobile"
        className={`fixed inset-0 top-0 flex h-[100svh] flex-col justify-between bg-noir px-6 pb-10 pt-28 transition-opacity duration-500 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <nav aria-label="Navigation mobile" className="flex flex-col gap-6">
          {items.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className={`font-serif text-4xl text-ivoire transition-all duration-700 ease-lux ${open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
              style={{ transitionDelay: open ? `${120 + i * 70}ms` : "0ms" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/reserver" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className={buttonClass("solid", "w-full")}>
          Prendre rendez-vous
        </Link>
      </div>
    </header>
  );
}
