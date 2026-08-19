"use client";

import { useActionState } from "react";

import { createCheckpointAction } from "@/actions/checkpoint-actions";
import { CHECKPOINT_KINDS } from "@/lib/domain/types";
import { todayIso } from "@/lib/format";

/** The form only picks a date and a kind — every number is computed server-side. */
export function CheckpointForm() {
  const [state, action, pending] = useActionState(createCheckpointAction, null);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="pz-label mb-2" htmlFor="checkpoint-date">
            Date
          </label>
          <input
            id="checkpoint-date"
            name="date"
            type="date"
            defaultValue={todayIso()}
            className="pz-input"
          />
        </div>
        <div>
          <label className="pz-label mb-2" htmlFor="checkpoint-kind">
            Kind
          </label>
          <select id="checkpoint-kind" name="kind" className="pz-input" defaultValue="SIMPLE">
            {CHECKPOINT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "SIMPLE" ? "Simple (30 days)" : "Full review (90 days)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="pz-label mb-2" htmlFor="checkpoint-notes">
          Notes (optional)
        </label>
        <input id="checkpoint-notes" name="notes" className="pz-input" />
      </div>

      {state ? (
        <p className={`text-sm ${state.ok ? "text-signal" : "text-alert"}`}>
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="pz-button" disabled={pending}>
        {pending ? "Computing…" : "Create checkpoint"}
      </button>
    </form>
  );
}
