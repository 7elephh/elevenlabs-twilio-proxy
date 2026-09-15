import type { ReactNode } from "react";

import { Card } from "@/components/ui";

/**
 * Section de reglages.
 *
 * `note` sert a dire ce qui manque quand une section n'est pas encore
 * modifiable. Le principe tenu partout : afficher la configuration reelle et
 * nommer ce qui bloque, plutot que proposer une commande sans effet.
 */
export function SettingsSection({
  title,
  description,
  note,
  children,
}: {
  title: string;
  description?: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mb-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-mist-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-mist-600">{description}</p>
        ) : null}
      </div>

      <div className="text-sm text-mist-300">{children}</div>

      {note ? (
        <p className="mt-3 border-t border-night-800 pt-3 text-xs text-mist-600">{note}</p>
      ) : null}
    </Card>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-night-800 py-2 last:border-b-0">
      <span className="text-xs text-mist-600">{label}</span>
      <span className="text-right text-sm text-mist-200">{value}</span>
    </div>
  );
}

export function Chips({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <p className="text-sm text-mist-600">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full border border-night-600 bg-night-800 px-2.5 py-1 text-xs text-mist-300"
        >
          {value}
        </li>
      ))}
    </ul>
  );
}
