import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`pz-card ${className}`}>{children}</section>;
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
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-chalk-300">
          {title}
        </h2>
        {hint ? <p className="mt-1 text-xs text-chalk-600">{hint}</p> : null}
      </div>
      {action}
    </div>
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
    <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-chalk-600">
        {label}
      </p>
      <p className="pz-stat mt-1 leading-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-chalk-600">{sub}</p> : null}
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
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/60 p-6 text-center">
      <p className="font-semibold text-chalk-300">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-chalk-600">{body}</p>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className="pz-button mt-4 max-w-xs mx-auto">
          {ctaLabel}
        </Link>
      ) : null}
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
    <header className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-chalk-100">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-chalk-600">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: ReactNode;
}) {
  const tones = {
    info: "border-ink-700 bg-ink-900 text-chalk-500",
    warn: "border-caution/40 bg-caution/10 text-caution",
    danger: "border-alert/40 bg-alert/10 text-alert",
  } as const;
  return (
    <p className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${tones[tone]}`}>
      {children}
    </p>
  );
}
