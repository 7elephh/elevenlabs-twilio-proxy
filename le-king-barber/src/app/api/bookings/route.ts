import { after, NextResponse, type NextRequest } from "next/server";

import { BookingError, createOnlineBooking } from "@/lib/booking/engine";
import { syncBookingToGoogle } from "@/lib/google/calendar";
import { clientIp, jsonError } from "@/lib/http";
import { notifyBooking } from "@/lib/notifications/notify";
import { serverEnv } from "@/lib/server-env";
import { isServiceConfigured } from "@/lib/supabase/service";
import { bookingRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isServiceConfigured() || !serverEnv.manageTokenSecret) {
      throw new BookingError("not_configured", "La réservation en ligne n'est pas encore activée.", 503);
    }
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.nextUrl.host) throw new BookingError("forbidden", "Origine non autorisée.", 403);

    const body = await request.json().catch(() => null);
    const parsed = bookingRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return NextResponse.json({ error: "validation", message: "Merci de vérifier le formulaire.", fieldErrors }, { status: 422 });
    }

    const { booking, token } = await createOnlineBooking(parsed.data, clientIp(request.headers));

    // Emails et agenda Google après la réponse : la réservation ne dépend pas d'eux.
    after(async () => {
      await Promise.allSettled([notifyBooking(booking.id, "created"), syncBookingToGoogle(booking.id)]);
    });

    return NextResponse.json({ token }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
