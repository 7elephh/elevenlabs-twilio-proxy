"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, type ActionResult } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500),
  price: z.coerce.number().min(0, "Prix invalide").max(1000),
  duration: z.union([z.literal(""), z.coerce.number().int().min(5, "Durée minimale : 5 min").max(480)]),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export async function saveServiceAction(id: string | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = schema.safeParse({
    name: form.get("name"),
    description: form.get("description") ?? "",
    price: String(form.get("price") ?? "").replace(",", "."),
    duration: form.get("duration") ?? "",
    sortOrder: form.get("sortOrder") || 0,
    isActive: form.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;
  const duration = d.duration === "" ? null : d.duration;
  if (d.isActive && !duration) return { ok: false, message: "Indiquez une durée pour proposer cette prestation à la réservation." };
  const row = {
    name: d.name,
    description: d.description || null,
    price_cents: Math.round(d.price * 100),
    duration_minutes: duration,
    sort_order: d.sortOrder,
    is_active: d.isActive,
  };
  const { error } = id ? await supabase.from("services").update(row).eq("id", id) : await supabase.from("services").insert(row);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Prestation mise à jour." : "Prestation ajoutée." };
}

export async function deleteServiceAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  // Les rendez-vous conservent un instantané (nom, prix, durée) : l'historique reste intact.
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { ok: false, message: "Suppression impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Prestation supprimée." };
}
