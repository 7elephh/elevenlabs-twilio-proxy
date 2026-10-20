import type { Metadata } from "next";

import { ActionForm, Submit } from "@/components/admin/form";
import { Input } from "@/components/admin/ui";
import { Monogram } from "@/components/site/logo";
import { isSupabaseConfigured } from "@/lib/env";

import { signInAction } from "./actions";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Monogram className="mx-auto w-14" priority />
        <h1 className="mt-8 text-center text-4xl">Espace salon</h1>
        {!isSupabaseConfigured ? (
          <p className="mt-8 text-center text-sm leading-relaxed text-ivoire/60">
            Supabase n&apos;est pas encore configuré. Renseignez les variables d&apos;environnement décrites dans le README.
          </p>
        ) : (
          <ActionForm action={signInAction} className="mt-10 space-y-5">
            {erreur === "acces" && <p className="text-sm text-red-300">Ce compte n&apos;a pas accès à l&apos;espace salon.</p>}
            <Input label="Email" name="email" type="email" autoComplete="email" required />
            <Input label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
            <Submit className="w-full">Se connecter</Submit>
          </ActionForm>
        )}
      </div>
    </main>
  );
}
