import { SITE_URL } from "@/lib/env";

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

export function buildIcs(input: {
  uid: string;
  start: string;
  end: string;
  summary: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Le King Barber//Reservations//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}@${new URL(SITE_URL).host}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(input.end)}`,
    `SUMMARY:${escape(input.summary)}`,
    input.location ? `LOCATION:${escape(input.location)}` : null,
    input.description ? `DESCRIPTION:${escape(input.description)}` : null,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

/** Lien « Ajouter à Google Agenda » (aucune connexion requise côté client). */
export function googleCalendarTemplateUrl(input: { start: string; end: string; summary: string; location?: string | null }) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.summary,
    dates: `${icsDate(input.start)}/${icsDate(input.end)}`,
  });
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
