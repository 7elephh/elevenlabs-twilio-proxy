import type { TestProtocol } from "./types";

/**
 * Turns raw START TEST input into the stored result.
 *
 * Everything the UI shows later is derived from `value` (the headline number)
 * plus `detail` (the breakdown), so the aggregation rule of each protocol lives
 * here and nowhere else.
 */

export type RawTestInput = {
  attempts: number[];
  extras: Record<string, number | string>;
};

export type ScoredResult = {
  value: number;
  attempts: number[];
  detail: Record<string, number | string>;
  variant: string | null;
};

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function scoreResult(
  protocol: TestProtocol,
  input: RawTestInput,
): ScoredResult {
  const attempts = input.attempts.filter((a) => Number.isFinite(a));
  const extras = input.extras;

  switch (protocol.slug) {
    case "slalom-ball-control": {
      const bestRaw = Math.min(...attempts);
      const faults = Number(extras.cone_faults ?? 0);
      const penalty = Number(extras.penalty_seconds ?? 0.5);
      const corrected = round(bestRaw + faults * penalty, 2);
      return {
        value: corrected,
        attempts,
        detail: {
          best_raw_time: round(bestRaw, 2),
          mean_raw_time: round(mean(attempts), 2),
          cone_faults: faults,
          penalty_seconds: penalty,
          corrected_time: corrected,
        },
        variant: null,
      };
    }

    case "crossing-accuracy": {
      const near = Number(extras.near_post ?? 0);
      const central = Number(extras.central ?? 0);
      const far = Number(extras.far_post ?? 0);
      const total = near + central + far;
      return {
        value: total,
        attempts: [near, central, far],
        detail: {
          near_post: near,
          central: central,
          far_post: far,
          max_score: 24,
          crosses: 12,
        },
        variant: null,
      };
    }

    case "finishing-accuracy": {
      const goals = attempts[0] ?? 0;
      const onTarget = Number(extras.shots_on_target ?? 0);
      const misses = Number(extras.misses ?? 0);
      const total = goals + onTarget + misses;
      return {
        value: goals,
        attempts: [goals],
        detail: {
          goals,
          shots_on_target: onTarget,
          misses,
          attempts: total,
          // Goals + on-frame attempts, i.e. everything that hit the frame.
          on_frame: goals + onTarget,
        },
        variant: null,
      };
    }

    case "timed-run": {
      const time = attempts[0] ?? 0;
      const distance = Number(extras.distance_m ?? 1000);
      return {
        value: round(time, 1),
        attempts: [round(time, 1)],
        detail: {
          distance_m: distance,
          time_seconds: round(time, 1),
          pace_s_per_km: distance > 0 ? round((time / distance) * 1000, 1) : 0,
          speed_kmh: time > 0 ? round((distance / time) * 3.6, 2) : 0,
        },
        variant: String(distance),
      };
    }

    default:
      break;
  }

  // Generic aggregation for the remaining protocols.
  if (protocol.aggregation === "BEST") {
    const best =
      protocol.improvementDirection === "HIGHER_IS_BETTER"
        ? Math.max(...attempts)
        : Math.min(...attempts);
    return {
      value: round(best, 2),
      attempts,
      detail: {
        best: round(best, 2),
        mean: round(mean(attempts), 2),
        attempts_count: attempts.length,
      },
      variant: null,
    };
  }

  if (protocol.aggregation === "SUM") {
    const sum = attempts.reduce((s, v) => s + v, 0);
    return { value: sum, attempts, detail: { total: sum }, variant: null };
  }

  const single = attempts[0] ?? 0;
  const detail: Record<string, number | string> = { value: single };
  if (protocol.maxValue) {
    detail.max_value = protocol.maxValue;
    detail.success_rate_pct = round((single / protocol.maxValue) * 100, 1);
  }
  return { value: single, attempts: [single], detail, variant: null };
}

/** Per-protocol validity rules the generic zod schema cannot express. */
export function validateRawInput(
  protocol: TestProtocol,
  input: RawTestInput,
): string | null {
  const attempts = input.attempts.filter((a) => Number.isFinite(a));
  if (protocol.slug !== "crossing-accuracy" && attempts.length === 0) {
    return "Record at least one attempt.";
  }
  if (attempts.some((a) => a <= 0) && protocol.slug !== "finishing-accuracy") {
    return "Values must be greater than zero.";
  }
  if (protocol.maxValue && protocol.aggregation === "SINGLE") {
    if (attempts[0] > protocol.maxValue) {
      return `Value cannot exceed ${protocol.maxValue}.`;
    }
  }

  if (protocol.slug === "crossing-accuracy") {
    const zones = ["near_post", "central", "far_post"] as const;
    for (const zone of zones) {
      const v = Number(input.extras[zone] ?? 0);
      if (v < 0 || v > 8) return "Each zone scores between 0 and 8 (4 crosses x 2).";
    }
  }

  if (protocol.slug === "finishing-accuracy") {
    const goals = attempts[0] ?? 0;
    const onTarget = Number(input.extras.shots_on_target ?? 0);
    const misses = Number(input.extras.misses ?? 0);
    if (goals + onTarget + misses !== 20) {
      return "Goals + on target + missed must add up to 20 strikes.";
    }
  }

  return null;
}
