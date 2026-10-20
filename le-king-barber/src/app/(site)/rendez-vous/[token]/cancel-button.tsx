"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { cancelBookingAction } from "./actions";

export function CancelButton({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)} className="text-ivoire/60">
        Annuler ce rendez-vous
      </Button>
    );
  }
  return (
    <div className="border border-ivoire/15 p-6">
      <p className="text-ivoire/85">Tu confirmes l&apos;annulation ? Le créneau sera libéré pour un autre client.</p>
      {error && <p role="alert" className="mt-3 text-sm text-champagne">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelBookingAction(token);
              if (r.ok) router.refresh();
              else setError(r.message ?? "Erreur");
            })
          }
        >
          {pending ? "Annulation…" : "Oui, annuler"}
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          Garder mon rendez-vous
        </Button>
      </div>
    </div>
  );
}
