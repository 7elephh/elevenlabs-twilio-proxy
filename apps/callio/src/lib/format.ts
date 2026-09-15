/** Mises en forme d'affichage, en français, stables entre serveur et client. */

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const DATE_ONLY = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? DATE_TIME.format(d) : "—";
}

export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? DATE_ONLY.format(d) : "—";
}

/** Duree d'appel en minutes et secondes. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m === 0 ? `${s} s` : `${m} min ${String(s).padStart(2, "0")} s`;
}

/** Ecart relatif court : « il y a 3 h », « dans 2 j ». */
export function formatRelative(iso: string | null | undefined, now = new Date()): string {
  const d = parse(iso);
  if (!d) return "—";

  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);

  if (minutes < 1) return "à l'instant";
  const prefix = diffMs < 0 ? "il y a " : "dans ";
  if (minutes < 60) return `${prefix}${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${prefix}${hours} h`;

  const days = Math.round(hours / 24);
  return `${prefix}${days} j`;
}
