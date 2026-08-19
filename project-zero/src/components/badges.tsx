import type { MeasurementType, ReliabilityLevel, Trend } from "@/lib/domain/types";
import { TREND_LABELS } from "@/lib/domain/progress";
import { MEASUREMENT_TYPE_LABELS } from "@/lib/format";

const base =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

/** Reliability is always visible next to a value — never implied. */
export function ReliabilityBadge({
  level,
  mixed = false,
}: {
  level: ReliabilityLevel;
  mixed?: boolean;
}) {
  const tones: Record<ReliabilityLevel, string> = {
    HIGH: "bg-signal/15 text-signal",
    MEDIUM: "bg-caution/15 text-caution",
    LOW: "bg-alert/15 text-alert",
  };
  return (
    <span className={`${base} ${tones[level]}`}>
      {level} reliability{mixed ? " (mixed)" : ""}
    </span>
  );
}

export function MeasurementTypeBadge({ type }: { type: MeasurementType }) {
  return (
    <span className={`${base} bg-ink-700 text-chalk-300`}>
      {MEASUREMENT_TYPE_LABELS[type]}
    </span>
  );
}

export function TrendBadge({ trend }: { trend: Trend }) {
  const tones: Record<Trend, string> = {
    IMPROVING: "bg-signal/15 text-signal",
    STABLE: "bg-ink-700 text-chalk-300",
    DECLINING: "bg-alert/15 text-alert",
    INSUFFICIENT_DATA: "bg-ink-700 text-chalk-600",
  };
  return <span className={`${base} ${tones[trend]}`}>{TREND_LABELS[trend]}</span>;
}

/** Signed percent, coloured by whether it means progress for this metric. */
export function ChangeBadge({
  percent,
  isImprovement,
  suffix,
}: {
  percent: number | null;
  isImprovement?: boolean;
  suffix?: string;
}) {
  if (percent === null || !Number.isFinite(percent)) {
    return <span className={`${base} bg-ink-700 text-chalk-600`}>No reference</span>;
  }
  const tone = isImprovement
    ? "bg-signal/15 text-signal"
    : percent === 0
      ? "bg-ink-700 text-chalk-300"
      : "bg-alert/15 text-alert";
  const sign = percent > 0 ? "+" : "";
  return (
    <span className={`${base} ${tone} tabular-nums`}>
      {sign}
      {percent.toFixed(1)} %{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className={`${base} border border-caution/40 bg-caution/10 text-caution`}>
      Demo
    </span>
  );
}

export function WeightBadge({ weight }: { weight: string }) {
  const tones: Record<string, string> = {
    HIGH: "bg-signal/15 text-signal",
    MEDIUM: "bg-caution/15 text-caution",
    LOW: "bg-ink-700 text-chalk-500",
    NONE: "bg-ink-800 text-chalk-600",
  };
  return <span className={`${base} ${tones[weight] ?? tones.NONE}`}>{weight}</span>;
}
