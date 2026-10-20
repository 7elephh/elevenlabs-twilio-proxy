import type { ComponentProps, ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-4xl md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ivoire/55">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`border border-ivoire/10 bg-noir-soft p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          {title && <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Input({ label, hint, className = "", ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ivoire/60">{label}</span>
      <input className="w-full border border-ivoire/15 bg-noir px-3 py-2.5 text-[15px] text-ivoire placeholder:text-ivoire/30 focus:border-champagne focus:outline-none" {...props} />
      {hint && <span className="mt-1 block text-xs text-ivoire/40">{hint}</span>}
    </label>
  );
}

export function Textarea({ label, hint, className = "", ...props }: ComponentProps<"textarea"> & { label: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ivoire/60">{label}</span>
      <textarea className="w-full border border-ivoire/15 bg-noir px-3 py-2.5 text-[15px] text-ivoire focus:border-champagne focus:outline-none" rows={4} {...props} />
      {hint && <span className="mt-1 block text-xs text-ivoire/40">{hint}</span>}
    </label>
  );
}

export function Select({ label, children, className = "", ...props }: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ivoire/60">{label}</span>
      <select className="w-full border border-ivoire/15 bg-noir px-3 py-2.5 text-[15px] text-ivoire focus:border-champagne focus:outline-none" {...props}>
        {children}
      </select>
    </label>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm text-ivoire/80">
      <input type="checkbox" className="h-4 w-4 accent-[#B8AD99]" {...props} />
      {label}
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "border-champagne/50 text-champagne",
  cancelled: "border-ivoire/15 text-ivoire/40 line-through",
  completed: "border-ivoire/25 text-ivoire/70",
  no_show: "border-red-400/40 text-red-200",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[status] ?? ""}`}>{label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-ivoire/45">{children}</p>;
}
