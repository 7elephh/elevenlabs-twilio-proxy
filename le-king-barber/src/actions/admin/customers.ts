"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, type ActionResult } from "@/lib/auth";

export async function saveCustomerNotesAction(id: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 1000);
  const { error } = await supabase.from("customers").update({ notes: notes || null }).eq("id", id);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true, message: "Notes enregistrées." };
}

export async function anonymizeCustomerAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("anonymize_customer", { p_customer_id: id });
  if (error) return { ok: false, message: "Anonymisation impossible." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Données personnelles effacées. L'historique des rendez-vous est conservé de façon anonyme." };
}
