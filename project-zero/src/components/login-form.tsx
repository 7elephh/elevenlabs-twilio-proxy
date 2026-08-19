"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Email + password auth against Supabase. One account is enough for V0.1. */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError, data } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      setInfo("Check your inbox to confirm the address, then sign in.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="pz-label mb-2" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="pz-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="pz-label mb-2" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="pz-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </div>

      {error ? <p className="text-sm text-alert">{error}</p> : null}
      {info ? <p className="text-sm text-signal">{info}</p> : null}

      <button type="submit" className="pz-button" disabled={pending}>
        {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        className="w-full text-xs text-chalk-600 underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "Create an account" : "I already have an account"}
      </button>
    </form>
  );
}
