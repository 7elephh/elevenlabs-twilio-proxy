"use client";

import { useState, useTransition } from "react";

import { clearDemoDataAction } from "@/actions/profile-actions";

/** One button, one confirmation: every row flagged DEMO is removed. */
export function DemoDataControls({ demoCount }: { demoCount: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (demoCount === 0 && !message) {
    return (
      <p className="text-sm text-chalk-600">
        No demonstration data in this account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-chalk-500">
        {demoCount} row{demoCount > 1 ? "s" : ""} flagged as demonstration data.
      </p>
      {confirming ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="pz-button-ghost w-full"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pz-button bg-alert text-ink-950"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await clearDemoDataAction();
                setMessage(result.message);
                setConfirming(false);
              })
            }
          >
            {pending ? "Deleting…" : "Confirm deletion"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pz-button-ghost w-full"
          onClick={() => setConfirming(true)}
        >
          Delete all demo data
        </button>
      )}
      {message ? <p className="text-sm text-signal">{message}</p> : null}
    </div>
  );
}
