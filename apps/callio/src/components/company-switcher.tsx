"use client";

import { useRef } from "react";

import type { Company } from "@/lib/domain/types";
import { selectCompanyAction } from "@/app/app/actions";

/**
 * Selecteur d'entreprise.
 *
 * Masque quand l'utilisateur n'appartient qu'a une entreprise, mais le chemin
 * multi-appartenance existe des maintenant : ajouter une seconde ligne dans
 * company_members suffit a le faire apparaitre.
 */
export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: Company[];
  activeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (companies.length <= 1) return null;

  return (
    <form ref={formRef} action={selectCompanyAction}>
      <label className="sr-only" htmlFor="companyId">
        Entreprise active
      </label>
      <select
        id="companyId"
        name="companyId"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="cal-input py-2 text-sm"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="cal-button-ghost mt-2">
          Changer
        </button>
      </noscript>
    </form>
  );
}
