import { NextResponse, type NextRequest } from "next/server";

import { BookingError, getAvailability } from "@/lib/booking/engine";
import { jsonError } from "@/lib/http";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isValidDateString } from "@/lib/time";
import { availabilityQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!isServiceConfigured()) throw new BookingError("not_configured", "La réservation en ligne n'est pas encore activée.", 503);
    const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success || !isValidDateString(parsed.data.from) || !isValidDateString(parsed.data.to) || parsed.data.to < parsed.data.from) {
      throw new BookingError("bad_request", "Requête invalide.", 400);
    }
    const spanDays = (Date.parse(parsed.data.to) - Date.parse(parsed.data.from)) / 86_400_000;
    if (spanDays > 31) throw new BookingError("bad_request", "Période trop longue.", 400);
    const result = await getAvailability(parsed.data.serviceId, parsed.data.from, parsed.data.to);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
