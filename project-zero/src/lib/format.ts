/** Presentation helpers. All numbers shown in the UI go through here. */

export function formatValue(value: number, unit: string): string {
  if (unit === "s") return `${value.toFixed(2)} s`;
  if (unit.startsWith("/")) return `${value} / ${unit.slice(1)}`;
  if (unit === "goals /20") return `${value} / 20`;
  if (unit === "touches") return `${value}`;
  return `${value} ${unit}`;
}

export function formatUnitSuffix(unit: string): string {
  if (unit === "touches") return "touches";
  if (unit === "s") return "seconds";
  return unit;
}

export function formatPercent(percent: number, decimals = 1): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(decimals)} %`;
}

export function formatDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysSince(date: string, now: Date = new Date()): number {
  const then = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((today - then) / 86_400_000);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export const SESSION_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  TEAM_TRAINING: "Team training",
  MATCH: "Match",
  PHYSICAL: "Physical",
};

export const MEASUREMENT_METHOD_LABELS: Record<string, string> = {
  MANUAL_COUNT: "Manual count",
  PHONE_VIDEO: "Phone video",
  STOPWATCH: "Stopwatch",
  WEARABLE: "Wearable",
  OTHER: "Other",
};

export const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  OBJECTIVE: "Objective",
  SEMI_OBJECTIVE: "Semi-objective",
  SUBJECTIVE: "Subjective",
};
