import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BookingWithCustomer } from "@/lib/types";

export const BOOKING_SELECT = "*, customer:customers(id, first_name, last_name, phone, email)";

export async function bookingsBetween(supabase: SupabaseClient, from: Date, to: Date, includeCancelled = false) {
  let q = supabase.from("bookings").select(BOOKING_SELECT).lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()).order("starts_at");
  if (!includeCancelled) q = q.neq("status", "cancelled");
  const { data } = await q;
  return (data ?? []) as BookingWithCustomer[];
}

export const customerName = (b: BookingWithCustomer) => (b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : "Client supprimé");
