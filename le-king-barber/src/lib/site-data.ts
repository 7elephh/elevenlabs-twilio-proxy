import "server-only";
import { cache } from "react";

import { createClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { BusinessHour, BusinessSettings, GalleryImage, Service, Testimonial } from "@/lib/types";

/** Valeurs utilisées tant que la base n'est pas branchée (aucune donnée commerciale inventée). */
export const DEFAULT_SETTINGS: BusinessSettings = {
  salon_name: "Le King Barber",
  hero_title: "L'art de soigner son style.",
  hero_subtitle: null,
  hero_image_path: null,
  about_title: null,
  about_text: null,
  experience_text: null,
  barber_name: null,
  barber_bio: null,
  barber_photo_path: null,
  address_line: null,
  postal_code: null,
  city: null,
  phone: null,
  email: null,
  instagram_url: null,
  google_maps_url: null,
  google_reviews_url: null,
  timezone: "Europe/Paris",
  slot_interval_minutes: 15,
  buffer_minutes: 0,
  min_notice_minutes: 60,
  max_advance_days: 60,
  cancellation_notice_minutes: 120,
  max_active_bookings_per_customer: 2,
  booking_enabled: true,
  data_retention_months: 36,
  legal_name: null,
  legal_form: null,
  siret: null,
  legal_address: null,
  publication_director: null,
  hosting_provider: null,
};

export interface SiteData {
  configured: boolean;
  settings: BusinessSettings;
  services: Service[];
  hours: BusinessHour[];
  gallery: GalleryImage[];
  testimonials: Testimonial[];
}

export const getSiteData = cache(async (): Promise<SiteData> => {
  if (!isSupabaseConfigured) {
    return { configured: false, settings: DEFAULT_SETTINGS, services: [], hours: [], gallery: [], testimonials: [] };
  }
  // Client anonyme sans cookies : contenus publics, mis en cache (ISR).
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [settings, services, hours, gallery, testimonials] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("services").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("business_hours").select("id, weekday, opens_at, closes_at").order("weekday").order("opens_at"),
    supabase.from("gallery_images").select("*").eq("is_published", true).order("sort_order").limit(24),
    supabase.from("testimonials").select("*").eq("is_published", true).order("review_date", { ascending: false }).limit(12),
  ]);
  return {
    configured: true,
    settings: { ...DEFAULT_SETTINGS, ...(settings.data ?? {}) },
    services: (services.data ?? []) as Service[],
    hours: (hours.data ?? []) as BusinessHour[],
    gallery: (gallery.data ?? []) as GalleryImage[],
    testimonials: (testimonials.data ?? []) as Testimonial[],
  };
});

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/site-media/${path}`;
}

export function fullAddress(s: BusinessSettings): string | null {
  const parts = [s.address_line, [s.postal_code, s.city].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function mapsUrl(s: BusinessSettings): string | null {
  if (s.google_maps_url) return s.google_maps_url;
  const address = fullAddress(s);
  return address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.salon_name}, ${address}`)}`
    : null;
}
