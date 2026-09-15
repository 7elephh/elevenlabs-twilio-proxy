import Link from "next/link";
import type { ReactNode } from "react";

import type { Tone } from "@/lib/domain/labels";

/**
 * Primitives d'interface.
 *
 * Elles ne portent aucune logique metier : elles recoivent des valeurs deja
 * calculees et se contentent de les presenter. Toute la couleur vient des
 * tokens Tailwind, donc du seul fichier tailwind.config.ts.
 */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`cal-card p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-mist-100">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-mist-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-mist-100 sm:text-2xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-mist-500">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-night-600 bg-night-800 text-mist-300",
  accent: "border-callio-700 bg-callio-700/25 text-callio-200",
  positive: "border-ok-dim bg-ok-dim/30 text-ok",
  warning: "border-warn-dim bg-warn-dim/30 text-warn",
  negative: "border-danger-dim bg-danger-dim/30 text-danger",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="cal-card p-4">
      <p className="cal-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-mist-100">{value}</p>
      {sub ? <p className="mt-1 text-xs text-mist-500">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-night-700 bg-night-900/50 px-6 py-12 text-center">
      <p className="font-medium text-mist-300">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">{body}</p>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className="cal-button mt-5">
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Marque une fonctionnalite dont l'integration externe n'est pas branchee.
 *
 * Elle existe pour qu'aucun bouton inerte ne soit presente comme fonctionnel :
 * l'ecran dit ce qui manque, au lieu de faire semblant.
 */
export function PendingIntegration({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-control border border-night-700 bg-night-900/70 px-3 py-2.5 text-xs text-mist-500">
      <span aria-hidden="true" className="mt-px text-callio-400">
        ●
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Enveloppe de tableau : defilement horizontal isole, jamais la page entiere. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[42rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-night-700 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-mist-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`border-b border-night-800 px-3 py-3 align-middle ${className}`}>
      {children}
    </td>
  );
}
