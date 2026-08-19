import { PROTOCOLS_BY_SLUG } from "./protocols";
import type {
  ImprovementDirection,
  ReliabilityLevel,
  TestResult,
  Trend,
} from "./types";

/**
 * Progression maths.
 *
 * Two rules drive everything here:
 *  1. `improvement_direction` decides whether a delta is progress or regression —
 *     never the sign of the delta alone.
 *  2. A trend is never claimed from a single measurement. Below three
 *     observations the answer is INSUFFICIENT_DATA, full stop.
 */

/** Number of most recent observations fed to the regression. */
export const TREND_WINDOW = 8;
/** Minimum observations before any trend is claimed. */
export const TREND_MIN_OBSERVATIONS = 3;
/**
 * Relative change over the observed window below which we call it STABLE.
 * Keeps day-to-day noise (measurement error on a phone-timed sprint) from being
 * reported as progress.
 */
export const TREND_STABLE_THRESHOLD = 0.03;

export type MetricPoint = {
  date: string;
  value: number;
  reliability: ReliabilityLevel;
  protocolVersion: number;
  resultId: string;
};

export type TrendResult = {
  trend: Trend;
  /** Signed slope in metric units per day (null when not computable). */
  slopePerDay: number | null;
  /** Modelled relative change across the observed window, signed in raw units. */
  relativeChange: number | null;
  observations: number;
  label: string;
};

export const TREND_LABELS: Record<Trend, string> = {
  IMPROVING: "Likely progress",
  STABLE: "Stable",
  DECLINING: "Likely decline",
  INSUFFICIENT_DATA: "Insufficient data",
};

/** Metric identity: a protocol, plus its variant when variants are incomparable. */
export function metricKey(protocolSlug: string, variant?: string | null): string {
  return variant ? `${protocolSlug}::${variant}` : protocolSlug;
}

export function splitMetricKey(key: string): { slug: string; variant: string | null } {
  const [slug, variant] = key.split("::");
  return { slug, variant: variant ?? null };
}

export function metricLabel(key: string): string {
  const { slug, variant } = splitMetricKey(key);
  const protocol = PROTOCOLS_BY_SLUG[slug];
  const name = protocol?.name ?? slug;
  if (!variant) return name;
  if (slug === "timed-run") return `${name} — ${Number(variant) / 1000} km`;
  return `${name} — ${variant}`;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / 86_400_000;
}

/**
 * Simple least-squares regression of value against days elapsed.
 * Returns null when the x values carry no variance (all points same day).
 */
export function linearSlope(points: MetricPoint[]): number | null {
  if (points.length < 2) return null;
  const origin = points[0].date;
  const xs = points.map((p) => daysBetween(origin, p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Trend over the last `TREND_WINDOW` observations.
 * `points` must be sorted oldest first.
 */
export function computeTrend(
  points: MetricPoint[],
  direction: ImprovementDirection,
  stableThreshold: number = TREND_STABLE_THRESHOLD,
): TrendResult {
  const window = points.slice(-TREND_WINDOW);
  if (window.length < TREND_MIN_OBSERVATIONS) {
    return {
      trend: "INSUFFICIENT_DATA",
      slopePerDay: null,
      relativeChange: null,
      observations: window.length,
      label: TREND_LABELS.INSUFFICIENT_DATA,
    };
  }

  const slope = linearSlope(window);
  const meanY =
    window.reduce((s, p) => s + p.value, 0) / window.length;

  if (slope === null || meanY === 0) {
    // Several measurements but no time spread (or a degenerate mean): we can
    // observe repetition, not a direction.
    return {
      trend: "INSUFFICIENT_DATA",
      slopePerDay: slope,
      relativeChange: null,
      observations: window.length,
      label: TREND_LABELS.INSUFFICIENT_DATA,
    };
  }

  const spanDays = daysBetween(window[0].date, window[window.length - 1].date);
  const modelledChange = slope * spanDays;
  const relativeChange = modelledChange / Math.abs(meanY);

  let trend: Trend;
  if (Math.abs(relativeChange) < stableThreshold) {
    trend = "STABLE";
  } else if (direction === "HIGHER_IS_BETTER") {
    trend = relativeChange > 0 ? "IMPROVING" : "DECLINING";
  } else {
    trend = relativeChange < 0 ? "IMPROVING" : "DECLINING";
  }

  return {
    trend,
    slopePerDay: slope,
    relativeChange,
    observations: window.length,
    label: TREND_LABELS[trend],
  };
}

export type Change = {
  /** Raw percent change, sign kept as-is: -4.9 for 3.48 s -> 3.31 s. */
  percent: number;
  /** Absolute difference in metric units. */
  delta: number;
  /** True when the change goes the way `direction` calls progress. */
  isImprovement: boolean;
};

export function computeChange(
  from: number,
  to: number,
  direction: ImprovementDirection,
): Change | null {
  if (from === 0) return null;
  const delta = to - from;
  const percent = (delta / Math.abs(from)) * 100;
  const isImprovement =
    direction === "HIGHER_IS_BETTER" ? delta > 0 : delta < 0;
  return { percent, delta, isImprovement };
}

export function bestValue(
  values: number[],
  direction: ImprovementDirection,
): number | null {
  if (values.length === 0) return null;
  return direction === "HIGHER_IS_BETTER"
    ? Math.max(...values)
    : Math.min(...values);
}

export type MetricSeries = {
  metricKey: string;
  protocolSlug: string;
  variant: string | null;
  label: string;
  unit: string;
  improvementDirection: ImprovementDirection;
  points: MetricPoint[];
  baseline: MetricPoint | null;
  latest: MetricPoint;
  best: MetricPoint;
  observations: number;
  reliability: ReliabilityLevel;
  mixedReliability: boolean;
  /** Baseline and latest were produced by different protocol versions. */
  versionMismatch: boolean;
  changeVsBaseline: Change | null;
  /** Change between the last two observations. */
  changeVsPrevious: Change | null;
  trend: TrendResult;
};

/**
 * Group raw results into one comparable series per metric.
 * Results of unknown protocols are ignored rather than guessed at.
 */
export function buildMetricSeries(results: TestResult[]): MetricSeries[] {
  const grouped = new Map<string, TestResult[]>();
  for (const result of results) {
    if (!PROTOCOLS_BY_SLUG[result.protocolSlug]) continue;
    const key = metricKey(result.protocolSlug, result.variant);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(result);
    else grouped.set(key, [result]);
  }

  const series: MetricSeries[] = [];
  for (const [key, group] of grouped) {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime(),
    );
    const protocol = PROTOCOLS_BY_SLUG[sorted[0].protocolSlug];
    const points: MetricPoint[] = sorted.map((r) => ({
      date: r.performedAt,
      value: r.value,
      reliability: r.reliabilityLevel,
      protocolVersion: r.protocolVersion,
      resultId: r.id,
    }));

    const baselineResult = sorted.find((r) => r.isBaseline) ?? sorted[0];
    const baseline =
      points.find((p) => p.resultId === baselineResult.id) ?? null;
    const latest = points[points.length - 1];
    const bestVal = bestValue(
      points.map((p) => p.value),
      protocol.improvementDirection,
    );
    const best = points.find((p) => p.value === bestVal) ?? latest;
    const previous = points.length >= 2 ? points[points.length - 2] : null;

    series.push({
      metricKey: key,
      protocolSlug: protocol.slug,
      variant: sorted[0].variant,
      label: metricLabel(key),
      unit: protocol.unit,
      improvementDirection: protocol.improvementDirection,
      points,
      baseline,
      latest,
      best,
      observations: points.length,
      reliability: latest.reliability,
      mixedReliability: new Set(points.map((p) => p.reliability)).size > 1,
      versionMismatch:
        baseline !== null && baseline.protocolVersion !== latest.protocolVersion,
      changeVsBaseline:
        baseline && baseline.resultId !== latest.resultId
          ? computeChange(baseline.value, latest.value, protocol.improvementDirection)
          : null,
      changeVsPrevious: previous
        ? computeChange(previous.value, latest.value, protocol.improvementDirection)
        : null,
      trend: computeTrend(points, protocol.improvementDirection),
    });
  }

  return series.sort((a, b) => a.label.localeCompare(b.label));
}

export function filterPointsByRange(
  points: MetricPoint[],
  range: RangeKey,
  now: Date = new Date(),
): MetricPoint[] {
  const days = RANGE_DAYS[range];
  if (days === null) return points;
  const cutoff = now.getTime() - days * 86_400_000;
  return points.filter((p) => new Date(p.date).getTime() >= cutoff);
}

export const RANGE_DAYS = {
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
  all: null,
} as const;

export type RangeKey = keyof typeof RANGE_DAYS;

export const RANGE_LABELS: Record<RangeKey, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "6m": "6 months",
  "1y": "1 year",
  all: "All time",
};
