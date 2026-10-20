"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { ActionResult } from "@/lib/auth";

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/** Formulaire relié à une action serveur, avec retour de statut accessible. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && (
        <p role="status" className={`mt-3 text-sm ${state.ok ? "text-champagne" : "text-red-300"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, variant = "solid", className = "" }: { children: ReactNode; variant?: "solid" | "outline" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  const styles = {
    solid: "bg-ivoire text-noir hover:bg-champagne",
    outline: "border border-ivoire/25 text-ivoire hover:border-champagne",
    danger: "border border-red-400/40 text-red-200 hover:bg-red-500/10",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`inline-flex items-center justify-center px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors disabled:opacity-50 ${styles} ${className}`}>
      {pending ? "…" : children}
    </button>
  );
}
