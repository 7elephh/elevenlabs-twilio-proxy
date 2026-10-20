import { formatDateTime, formatDuration, formatPrice } from "@/lib/time";

export interface BookingEmailData {
  salonName: string;
  firstName: string;
  lastName: string;
  phone: string;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  startsAt: string;
  timezone: string;
  address: string | null;
  salonPhone: string | null;
  manageUrl: string | null;
  note: string | null;
}

export type BookingEmailKind = "confirmation" | "barber_new" | "cancellation" | "update" | "reminder";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, rows: [string, string][], intro: string, cta?: { label: string; url: string }) {
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#8a857c;font-size:13px;width:120px">${escapeHtml(k)}</td><td style="padding:8px 0;color:#111214;font-size:15px">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#111214;color:#F2EDE4;text-decoration:none;padding:14px 22px;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F2EDE4;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<p style="margin:0 0 32px;font-family:Georgia,serif;font-size:13px;letter-spacing:.32em;color:#52504C">LE KING BARBER</p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:400;font-size:28px;color:#111214">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;color:#52504C;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>
<table style="width:100%;border-top:1px solid #d8d1c4;border-collapse:collapse">${table}</table>${button}
</div></body></html>`;
}

export function renderBookingEmail(kind: BookingEmailKind, d: BookingEmailData) {
  const when = formatDateTime(new Date(d.startsAt), d.timezone);
  const rows: [string, string][] = [
    ["Prestation", d.serviceName],
    ["Date", when],
    ["Durée", formatDuration(d.durationMinutes)],
    ["Tarif", formatPrice(d.priceCents)],
  ];
  if (d.address) rows.push(["Adresse", d.address]);
  const manage = d.manageUrl ? { label: "Gérer mon rendez-vous", url: d.manageUrl } : undefined;

  const variants: Record<BookingEmailKind, { subject: string; title: string; intro: string; rows: [string, string][]; cta?: typeof manage }> = {
    confirmation: {
      subject: `Rendez-vous confirmé — ${when}`,
      title: "Votre rendez-vous est confirmé",
      intro: `Bonjour ${d.firstName}, merci pour votre réservation. Voici le récapitulatif.`,
      rows,
      cta: manage,
    },
    update: {
      subject: `Rendez-vous modifié — ${when}`,
      title: "Votre rendez-vous a été modifié",
      intro: `Bonjour ${d.firstName}, votre rendez-vous a été mis à jour. Voici les nouveaux détails.`,
      rows,
      cta: manage,
    },
    cancellation: {
      subject: `Rendez-vous annulé — ${when}`,
      title: "Votre rendez-vous est annulé",
      intro: `Bonjour ${d.firstName}, le rendez-vous ci-dessous a bien été annulé.`,
      rows,
    },
    reminder: {
      subject: `Rappel : rendez-vous ${when}`,
      title: "À bientôt au salon",
      intro: `Bonjour ${d.firstName}, petit rappel de votre prochain rendez-vous.`,
      rows,
      cta: manage,
    },
    barber_new: {
      subject: `Nouvelle réservation — ${d.firstName} ${d.lastName} — ${when}`,
      title: "Nouvelle réservation",
      intro: "Un client vient de réserver en ligne.",
      rows: [["Client", `${d.firstName} ${d.lastName}`], ["Téléphone", d.phone], ...rows.slice(0, 4), ...(d.note ? ([["Note", d.note]] as [string, string][]) : [])],
    },
  };
  const v = variants[kind];
  const text = [v.title, "", v.intro, "", ...v.rows.map(([k, val]) => `${k} : ${val}`), v.cta ? `\n${v.cta.label} : ${v.cta.url}` : "", d.salonPhone ? `\nSalon : ${d.salonPhone}` : ""].join("\n");
  return { subject: v.subject, html: layout(v.title, v.rows, v.intro, v.cta), text };
}
