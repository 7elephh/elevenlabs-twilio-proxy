import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui";
import { resolveDataSource } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const source = resolveDataSource();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-7 text-center">
        <p className="cal-eyebrow">Callio</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-mist-100">
          Espace entreprise
        </h1>
      </div>

      <Card>
        {source === "demo" ? (
          <div>
            <p className="text-sm text-mist-300">
              L&apos;application tourne en <strong>mode démonstration</strong> : aucune
              base n&apos;est connectée, et l&apos;authentification est donc inactive.
            </p>
            <p className="mt-3 text-sm text-mist-500">
              Renseignez <code className="text-mist-300">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
              <code className="text-mist-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> pour
              activer la connexion réelle.
            </p>
            <Link href="/app/dashboard" className="cal-button mt-5 w-full">
              Entrer dans l&apos;espace de démonstration
            </Link>
          </div>
        ) : (
          <Suspense fallback={<p className="text-sm text-mist-500">Chargement…</p>}>
            <LoginForm />
          </Suspense>
        )}
      </Card>

      <p className="mt-6 text-center text-xs text-mist-600">
        <Link href="/" className="hover:text-mist-400">
          Retour au site
        </Link>
      </p>
    </main>
  );
}
