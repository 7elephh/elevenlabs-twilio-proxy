import { NextResponse } from "next/server";

import { findBookingByToken, loadBookingContext } from "@/lib/booking/engine";
import { buildIcs } from "@/lib/ics";
import { fullAddress } from "@/lib/site-data";
import { isServiceConfigured } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isServiceConfigured()) return new NextResponse("Not found", { status: 404 });
  const booking = await findBookingByToken(token);
  if (!booking) return new NextResponse("Not found", { status: 404 });
  const { settings } = await loadBookingContext();
  const ics = buildIcs({
    uid: booking.id,
    start: booking.starts_at,
    end: booking.ends_at,
    summary: `${booking.service_name} — ${settings.salon_name}`,
    location: fullAddress(settings),
    cancelled: booking.status === "cancelled",
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rendez-vous-le-king-barber.ics"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
