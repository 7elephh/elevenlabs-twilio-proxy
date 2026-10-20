import "server-only";
import { NextResponse } from "next/server";

import { BookingError } from "@/lib/booking/engine";

export function clientIp(headers: Headers): string | null {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function jsonError(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error(error);
  return NextResponse.json(
    { error: "unknown", message: "Une erreur est survenue. Réessaie dans un instant." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
