export interface BusinessSettings {
  salon_name: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_path: string | null;
  about_title: string | null;
  about_text: string | null;
  experience_text: string | null;
  barber_name: string | null;
  barber_bio: string | null;
  barber_photo_path: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  google_reviews_url: string | null;
  timezone: string;
  slot_interval_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_notice_minutes: number;
  max_active_bookings_per_customer: number;
  booking_enabled: boolean;
  data_retention_months: number;
  legal_name: string | null;
  legal_form: string | null;
  siret: string | null;
  legal_address: string | null;
  publication_director: string | null;
  hosting_provider: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface BusinessHour {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface BlockedPeriod {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: "vacation" | "closure" | "block";
  reason: string | null;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  anonymized_at: string | null;
  created_at: string;
}

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export interface Booking {
  id: string;
  customer_id: string | null;
  service_id: string | null;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: "online" | "admin";
  contact_email: string | null;
  customer_note: string | null;
  admin_note: string | null;
  cancelled_at: string | null;
  cancelled_by: "customer" | "admin" | null;
  reminder_sent_at: string | null;
  google_event_id: string | null;
  google_sync_error: string | null;
  created_at: string;
}

export interface BookingWithCustomer extends Booking {
  customer: Pick<Customer, "id" | "first_name" | "last_name" | "phone" | "email"> | null;
}

export interface GalleryImage {
  id: string;
  storage_path: string;
  alt: string;
  sort_order: number;
  is_published: boolean;
}

export interface Testimonial {
  id: string;
  author_name: string;
  content: string;
  rating: number | null;
  source: string | null;
  review_date: string | null;
  is_published: boolean;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Honoré",
  no_show: "Absent",
};
