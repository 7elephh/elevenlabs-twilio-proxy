"use server";

import { after } from "next/server";

import { BookingError, cancelBookingByToken } from "@/lib/booking/engine";
import { syncBookingToGoogle } from "@/lib/google/calendar";
import { notifyBooking } from "@/lib/notifications/notify";

export async function cancelBookingAction(token: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const booking = await cancelBookingByToken(token);
    after(async () => {
      await Promise.allSettled([notifyBooking(booking.id, "cancelled_by_customer"), syncBookingToGoogle(booking.id)]);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof BookingError ? e.message : "Une erreur est survenue." };
  }
}
