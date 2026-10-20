"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, type ActionResult } from "@/lib/auth";

const TEXT_FIELDS = [
  "salon_name", "hero_title", "hero_subtitle", "about_title", "about_text", "experience_text", "barber_name", "barber_bio",
  "address_line", "postal_code", "city", "phone", "email", "instagram_url", "google_maps_url", "google_reviews_url",
  "legal_name", "legal_form", "siret", "legal_address", "publication_director", "hosting_provider",
] as const;
const URL_FIELDS = new Set(["instagram_url", "google_maps_url", "google_reviews_url"]);
const REQUIRED = new Set(["salon_name", "hero_title"]);

const NUMBER_FIELDS: Record<string, [number, number]> = {
  slot_interval_minutes: [5, 120],
  buffer_minutes: [0, 60],
  min_notice_minutes: [0, 10080],
  max_advance_days: [1, 365],
  cancellation_notice_minutes: [0, 10080],
  max_active_bookings_per_customer: [1, 20],
  data_retention_months: [1, 120],
};

/** Enregistre uniquement les champs présents dans le formulaire soumis. */
export async function saveSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const update: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    if (!form.has(field)) continue;
    const value = String(form.get(field) ?? "").trim().slice(0, 2000);
    if (REQUIRED.has(field) && !value) return { ok: false, message: "Le nom du salon et le titre principal sont obligatoires." };
    if (value && URL_FIELDS.has(field) && !z.url({ protocol: /^https$/ }).safeParse(value).success) {
      return { ok: false, message: "Les liens doivent commencer par https://" };
    }
    if (value && field === "email" && !z.email().safeParse(value).success) return { ok: false, message: "Email invalide." };
    update[field] = value || null;
  }
  for (const [field, [min, max]] of Object.entries(NUMBER_FIELDS)) {
    if (!form.has(field)) continue;
    const n = Number(form.get(field));
    if (!Number.isInteger(n) || n < min || n > max) return { ok: false, message: `Valeur hors limites (${min}–${max}).` };
    update[field] = n;
  }
  if (form.has("booking_enabled_present")) update.booking_enabled = form.get("booking_enabled") === "on";
  for (const field of ["hero_image_path", "barber_photo_path"]) {
    if (form.has(field)) update[field] = String(form.get(field)) || null;
  }
  const { error } = await supabase.from("business_settings").update(update).eq("id", 1);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Modifications publiées sur le site." };
}

export async function addGalleryImageAction(path: string, alt: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!/^[\w/.-]+$/.test(path)) return { ok: false, message: "Fichier invalide." };
  const { count } = await supabase.from("gallery_images").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("gallery_images").insert({ storage_path: path, alt: alt.trim().slice(0, 200) || "Coupe réalisée au salon", sort_order: count ?? 0 });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo ajoutée." };
}

export async function updateGalleryImageAction(id: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  if (!alt) return { ok: false, message: "Description requise (accessibilité)." };
  const { error } = await supabase
    .from("gallery_images")
    .update({ alt, is_published: form.get("is_published") === "on", sort_order: Number(form.get("sort_order")) || 0 })
    .eq("id", id);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo mise à jour." };
}

export async function deleteGalleryImageAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("gallery_images").delete().eq("id", id).select("storage_path").single();
  if (data?.storage_path) await supabase.storage.from("site-media").remove([data.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo supprimée." };
}

const testimonialSchema = z.object({
  author_name: z.string().trim().min(1, "Auteur requis").max(80),
  content: z.string().trim().min(1, "Texte requis").max(800),
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]),
  source: z.string().trim().max(60),
  review_date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  is_published: z.boolean(),
});

export async function saveTestimonialAction(id: string | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = testimonialSchema.safeParse({
    author_name: form.get("author_name"),
    content: form.get("content"),
    rating: form.get("rating") ?? "",
    source: form.get("source") ?? "",
    review_date: form.get("review_date") ?? "",
    is_published: form.get("is_published") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;
  const row = { ...d, rating: d.rating === "" ? null : d.rating, source: d.source || null, review_date: d.review_date || null };
  const { error } = id ? await supabase.from("testimonials").update(row).eq("id", id) : await supabase.from("testimonials").insert(row);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Avis enregistré." };
}

export async function deleteTestimonialAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  await supabase.from("testimonials").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Avis supprimé." };
}
