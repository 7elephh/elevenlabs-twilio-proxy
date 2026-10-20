"use client";

import { useState } from "react";

import { saveDayHoursAction } from "@/actions/admin/availability";
import { ActionForm, Submit } from "@/components/admin/form";

interface Range {
  opens: string;
  closes: string;
}

export function DayHoursEditor({ weekday, label, initial }: { weekday: number; label: string; initial: Range[] }) {
  const [ranges, setRanges] = useState<Range[]>(initial);
  return (
    <ActionForm action={saveDayHoursAction} className="border-b border-ivoire/10 py-4 last:border-0">
      <input type="hidden" name="weekday" value={weekday} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <p className="w-28 pt-2.5 text-sm">{label}</p>
        <div className="flex-1 space-y-2">
          {ranges.length === 0 && <p className="pt-2.5 text-sm text-ivoire/40">Fermé</p>}
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" name="opens" step={300} value={r.opens} onChange={(e) => setRanges((rs) => rs.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))} className="border border-ivoire/15 bg-noir px-2 py-2 text-sm" aria-label={`${label} ouverture ${i + 1}`} required />
              <span className="text-ivoire/40">–</span>
              <input type="time" name="closes" step={300} value={r.closes} onChange={(e) => setRanges((rs) => rs.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))} className="border border-ivoire/15 bg-noir px-2 py-2 text-sm" aria-label={`${label} fermeture ${i + 1}`} required />
              <button type="button" onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))} className="px-2 text-ivoire/40 hover:text-red-300" aria-label="Supprimer la plage">×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRanges((rs) => [...rs, rs.length ? { opens: "14:00", closes: "19:00" } : { opens: "09:00", closes: "12:00" }])}
            className="text-xs text-champagne hover:text-ivoire"
          >
            + {ranges.length ? "Ajouter une plage (après une pause)" : "Ouvrir ce jour"}
          </button>
        </div>
        <Submit variant="outline">Enregistrer</Submit>
      </div>
    </ActionForm>
  );
}
