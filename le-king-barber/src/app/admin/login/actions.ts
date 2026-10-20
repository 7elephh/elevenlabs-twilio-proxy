"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function signInAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: "Email ou mot de passe invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Identifiants incorrects." };
  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
