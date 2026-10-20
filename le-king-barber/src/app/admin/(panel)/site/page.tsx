/* eslint-disable @next/next/no-img-element */
import { deleteGalleryImageAction, deleteTestimonialAction, saveSettingsAction, saveTestimonialAction, updateGalleryImageAction } from "@/actions/admin/site";
import { ActionForm, Submit } from "@/components/admin/form";
import { BarberUpload, GalleryUpload, HeroUpload, RemoveImageButton } from "@/components/admin/site-uploads";
import { Card, Checkbox, Input, PageHeader, Select, Textarea } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_SETTINGS, mediaUrl } from "@/lib/site-data";
import type { BusinessSettings, GalleryImage, Testimonial } from "@/lib/types";

export default async function SiteContentPage() {
  const { supabase } = await requireAdmin();
  const [{ data: s0 }, { data: gallery }, { data: testimonials }] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("gallery_images").select("*").order("sort_order"),
    supabase.from("testimonials").select("*").order("created_at", { ascending: false }),
  ]);
  const s: BusinessSettings = { ...DEFAULT_SETTINGS, ...(s0 ?? {}) };
  const v = (x: string | null) => x ?? "";

  return (
    <>
      <PageHeader title="Contenus du site" subtitle="Chaque enregistrement est publié immédiatement." />
      <div className="grid max-w-5xl gap-6">
        <Card title="Accueil">
          <ActionForm action={saveSettingsAction} className="grid gap-4">
            <Input label="Titre principal" name="hero_title" defaultValue={s.hero_title} required maxLength={120} />
            <Textarea label="Sous-titre" name="hero_subtitle" defaultValue={v(s.hero_subtitle)} rows={2} maxLength={240} />
            <Submit className="justify-self-start">Enregistrer</Submit>
          </ActionForm>
          <div className="mt-6 grid gap-4 border-t border-ivoire/10 pt-6 sm:grid-cols-[200px_1fr]">
            {s.hero_image_path ? (
              <div className="space-y-2">
                <img src={mediaUrl(s.hero_image_path)!} alt="" className="aspect-video w-full object-cover" />
                <RemoveImageButton field="hero_image_path" />
              </div>
            ) : (
              <p className="text-xs text-ivoire/45">Sans photo, l&apos;accueil affiche le monogramme LK sur fond noir.</p>
            )}
            <HeroUpload />
          </div>
        </Card>

        <Card title="Le salon & le barbier">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Input label="Titre de la section" name="about_title" defaultValue={v(s.about_title)} className="sm:col-span-2" />
            <Textarea label="Concept & philosophie" name="about_text" defaultValue={v(s.about_text)} rows={5} className="sm:col-span-2" />
            <Textarea label="L'expérience proposée" name="experience_text" defaultValue={v(s.experience_text)} rows={3} className="sm:col-span-2" />
            <Input label="Nom du barbier" name="barber_name" defaultValue={v(s.barber_name)} hint="Vide = bloc masqué" />
            <Textarea label="Présentation du barbier" name="barber_bio" defaultValue={v(s.barber_bio)} rows={3} className="sm:col-span-2" />
            <Submit className="justify-self-start">Enregistrer</Submit>
          </ActionForm>
          <div className="mt-6 grid gap-4 border-t border-ivoire/10 pt-6 sm:grid-cols-[160px_1fr]">
            {s.barber_photo_path ? (
              <div className="space-y-2">
                <img src={mediaUrl(s.barber_photo_path)!} alt="" className="aspect-[4/5] w-full object-cover" />
                <RemoveImageButton field="barber_photo_path" />
              </div>
            ) : (
              <span />
            )}
            <BarberUpload />
          </div>
        </Card>

        <Card title="Coordonnées">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom du salon" name="salon_name" defaultValue={s.salon_name} required />
            <Input label="Téléphone" name="phone" type="tel" defaultValue={v(s.phone)} />
            <Input label="Adresse" name="address_line" defaultValue={v(s.address_line)} className="sm:col-span-2" />
            <Input label="Code postal" name="postal_code" defaultValue={v(s.postal_code)} />
            <Input label="Ville" name="city" defaultValue={v(s.city)} />
            <Input label="Email de contact" name="email" type="email" defaultValue={v(s.email)} />
            <Input label="Instagram (lien)" name="instagram_url" type="url" defaultValue={v(s.instagram_url)} placeholder="https://instagram.com/…" />
            <Input label="Lien Google Maps" name="google_maps_url" type="url" defaultValue={v(s.google_maps_url)} hint="Sinon, l'itinéraire est calculé depuis l'adresse." />
            <Input label="Lien des avis Google" name="google_reviews_url" type="url" defaultValue={v(s.google_reviews_url)} />
            <Submit className="justify-self-start">Enregistrer</Submit>
          </ActionForm>
        </Card>

        <Card title="Réservation en ligne">
          <div id="reservation" />
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="booking_enabled_present" value="1" />
            <div className="sm:col-span-3">
              <Checkbox name="booking_enabled" defaultChecked={s.booking_enabled} label="Réservation en ligne ouverte" />
            </div>
            <Select label="Pas des créneaux" name="slot_interval_minutes" defaultValue={String(s.slot_interval_minutes)}>
              {[5, 10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}
            </Select>
            <Input label="Marge entre rdv (min)" name="buffer_minutes" type="number" min={0} max={60} defaultValue={s.buffer_minutes} />
            <Input label="Délai minimum (min)" name="min_notice_minutes" type="number" min={0} defaultValue={s.min_notice_minutes} hint="Ex. 60 = au plus tard 1 h avant" />
            <Input label="Réservable jusqu'à (jours)" name="max_advance_days" type="number" min={1} max={365} defaultValue={s.max_advance_days} />
            <Input label="Annulation en ligne jusqu'à (min avant)" name="cancellation_notice_minutes" type="number" min={0} defaultValue={s.cancellation_notice_minutes} />
            <Input label="Rdv à venir max / client" name="max_active_bookings_per_customer" type="number" min={1} max={20} defaultValue={s.max_active_bookings_per_customer} />
            <Submit className="justify-self-start">Enregistrer</Submit>
          </ActionForm>
        </Card>

        <Card title="Galerie">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {((gallery ?? []) as GalleryImage[]).map((g) => (
              <div key={g.id} className="space-y-2">
                <img src={mediaUrl(g.storage_path)!} alt={g.alt} className={`aspect-[4/5] w-full object-cover ${g.is_published ? "" : "opacity-40"}`} />
                <ActionForm action={updateGalleryImageAction.bind(null, g.id)} className="space-y-2">
                  <input name="alt" defaultValue={g.alt} aria-label="Description" className="w-full border border-ivoire/15 bg-noir px-2 py-1.5 text-xs" />
                  <div className="flex items-center justify-between gap-2">
                    <Checkbox name="is_published" defaultChecked={g.is_published} label="Visible" />
                    <input name="sort_order" type="number" defaultValue={g.sort_order} aria-label="Ordre" className="w-14 border border-ivoire/15 bg-noir px-2 py-1 text-xs" />
                  </div>
                  <Submit variant="outline" className="w-full !py-2">OK</Submit>
                </ActionForm>
                <ActionForm action={deleteGalleryImageAction.bind(null, g.id)} confirm="Supprimer cette photo ?">
                  <button className="text-xs text-red-300">Supprimer</button>
                </ActionForm>
              </div>
            ))}
          </div>
          <div className="mt-6 max-w-md border-t border-ivoire/10 pt-6">
            <GalleryUpload />
          </div>
        </Card>

        <Card title="Avis clients">
          <p className="mb-5 text-sm text-ivoire/55">Saisissez uniquement des avis réels (Google, message client…), avec l&apos;accord de leur auteur.</p>
          <ul className="space-y-4">
            {((testimonials ?? []) as Testimonial[]).map((t) => (
              <li key={t.id} className="border border-ivoire/10 p-4">
                <TestimonialForm t={t} />
                <ActionForm action={deleteTestimonialAction.bind(null, t.id)} confirm="Supprimer cet avis ?" className="mt-2">
                  <button className="text-xs text-red-300">Supprimer</button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-ivoire/10 pt-6">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ivoire/60">Ajouter un avis</p>
            <TestimonialForm />
          </div>
        </Card>

        <Card title="Mentions légales & RGPD">
          <ActionForm action={saveSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Input label="Raison sociale / nom" name="legal_name" defaultValue={v(s.legal_name)} />
            <Input label="Forme juridique" name="legal_form" defaultValue={v(s.legal_form)} placeholder="EI, SASU…" />
            <Input label="SIRET" name="siret" defaultValue={v(s.siret)} />
            <Input label="Directeur de la publication" name="publication_director" defaultValue={v(s.publication_director)} />
            <Input label="Adresse du siège" name="legal_address" defaultValue={v(s.legal_address)} className="sm:col-span-2" />
            <Input label="Hébergeur" name="hosting_provider" defaultValue={v(s.hosting_provider)} className="sm:col-span-2" />
            <Input label="Conservation des données clients (mois)" name="data_retention_months" type="number" min={1} max={120} defaultValue={s.data_retention_months} />
            <Submit className="justify-self-start sm:col-span-2">Enregistrer</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

function TestimonialForm({ t }: { t?: Testimonial }) {
  return (
    <ActionForm action={saveTestimonialAction.bind(null, t?.id ?? null)} resetOnSuccess={!t} className="grid gap-3 sm:grid-cols-4">
      <Input label="Auteur" name="author_name" defaultValue={t?.author_name} required className="sm:col-span-2" />
      <Select label="Note" name="rating" defaultValue={t?.rating ? String(t.rating) : ""}>
        <option value="">—</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
      </Select>
      <Input label="Date" name="review_date" type="date" defaultValue={t?.review_date ?? ""} />
      <Textarea label="Avis" name="content" defaultValue={t?.content} rows={3} required className="sm:col-span-3" />
      <Input label="Source" name="source" defaultValue={t?.source ?? ""} placeholder="Google" />
      <div className="flex items-center gap-4 sm:col-span-4">
        <Checkbox name="is_published" defaultChecked={t?.is_published ?? true} label="Publié" />
        <Submit variant={t ? "outline" : "solid"}>{t ? "Enregistrer" : "Ajouter"}</Submit>
      </div>
    </ActionForm>
  );
}
