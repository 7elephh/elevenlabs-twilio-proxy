import { activeProtocols } from "./protocols";
import { effectiveWeight, effectiveWeightScore } from "./positions";
import { metricKey } from "./progress";
import type { MetricSeries } from "./progress";
import type { MetricWeight, Position, Role, TestProtocol, Trend } from "./types";

/**
 * Deterministic priority engine — no model, no scoring of the player.
 *
 * A metric is prioritised when it matters for the position/role AND the data is
 * either missing, stale, or not moving. Everything below is arithmetic the user
 * could redo by hand, which is the point.
 */

const TREND_POINTS: Record<Trend, number> = {
  DECLINING: 6,
  STABLE: 4,
  INSUFFICIENT_DATA: 3,
  IMPROVING: 0,
};

/** A test older than this is considered due again. */
export const RETEST_INTERVAL_DAYS = 30;

export type PriorityItem = {
  metricKey: string;
  protocol: TestProtocol;
  weight: MetricWeight;
  score: number;
  daysSinceLastTest: number | null;
  trend: Trend;
  reason: string;
};

export type PriorityInput = {
  position: Position;
  role: Role;
  series: MetricSeries[];
  now?: Date;
};

function daysSince(date: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
}

export function computePriorities({
  position,
  role,
  series,
  now = new Date(),
}: PriorityInput): PriorityItem[] {
  const byProtocol = new Map<string, MetricSeries>();
  for (const s of series) {
    // With variants, the most recently measured variant represents the protocol.
    const current = byProtocol.get(s.protocolSlug);
    if (
      !current ||
      new Date(s.latest.date).getTime() > new Date(current.latest.date).getTime()
    ) {
      byProtocol.set(s.protocolSlug, s);
    }
  }

  const items: PriorityItem[] = [];
  for (const protocol of activeProtocols()) {
    const weight = effectiveWeight(position, role, protocol.slug);
    if (weight === "NONE") continue;

    const weightScore = effectiveWeightScore(position, role, protocol.slug);
    const s = byProtocol.get(protocol.slug);

    if (!s) {
      items.push({
        metricKey: metricKey(protocol.slug),
        protocol,
        weight,
        score: weightScore * 10 + 12,
        daysSinceLastTest: null,
        trend: "INSUFFICIENT_DATA",
        reason: "Never measured — no baseline yet",
      });
      continue;
    }

    const age = daysSince(s.latest.date, now);
    const stalePoints = Math.min(10, (age / RETEST_INTERVAL_DAYS) * 5);
    const trendPoints = TREND_POINTS[s.trend.trend];
    const score = weightScore * 10 + stalePoints + trendPoints;

    let reason: string;
    if (s.trend.trend === "INSUFFICIENT_DATA") {
      reason = `Only ${s.observations} measurement${s.observations > 1 ? "s" : ""} — not enough to read a trend`;
    } else if (s.trend.trend === "DECLINING") {
      reason = "Likely decline over the recent window";
    } else if (s.trend.trend === "STABLE") {
      reason = "Flat over the recent window";
    } else if (age >= RETEST_INTERVAL_DAYS) {
      reason = `Progressing, but last measured ${age} days ago`;
    } else {
      reason = "Progressing — keep the current work";
    }

    items.push({
      metricKey: s.metricKey,
      protocol,
      weight,
      score,
      daysSinceLastTest: age,
      trend: s.trend.trend,
      reason,
    });
  }

  return items.sort((a, b) => b.score - a.score || a.protocol.slug.localeCompare(b.protocol.slug));
}

/** Top N priorities for the dashboard. V0.1 shows at most 3. */
export function currentPriorities(input: PriorityInput, limit = 3): PriorityItem[] {
  return computePriorities(input).slice(0, limit);
}

/** Tests worth running next: relevant, and either never done or overdue. */
export function suggestedTests(input: PriorityInput, limit = 4): PriorityItem[] {
  return computePriorities(input)
    .filter(
      (i) => i.daysSinceLastTest === null || i.daysSinceLastTest >= RETEST_INTERVAL_DAYS,
    )
    .slice(0, limit);
}
