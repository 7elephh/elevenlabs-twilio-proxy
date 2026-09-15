"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { credentialsSchema } from "@/lib/validation/schemas";

/**
 * Connexion par e-mail et mot de passe.
 *
 * Le formulaire valide avec le meme schema que le serveur, puis delegue a
 * Supabase Auth. Aucune decision d'autorisation n'est prise ici : le client
 * obtient une session, et c'est la RLS qui decide de ce qu'il peut lire.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Identifiants invalides");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
      if (authError) {
        setError(authError.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-4">
        <label className="cal-label" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="cal-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="mb-5">
        <label className="cal-label" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="cal-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-control border border-danger-dim bg-danger-dim/25 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" className="cal-button w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
