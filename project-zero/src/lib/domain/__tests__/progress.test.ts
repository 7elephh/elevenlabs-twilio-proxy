import { describe, expect, it } from "vitest";

import {
  bestValue,
  buildMetricSeries,
  computeChange,
  computeTrend,
  filterPointsByRange,
  linearSlope,
  metricKey,
  metricLabel,
  splitMetricKey,
  type MetricPoint,
} from "../progress";
import type { TestResult } from "../types";

function point(date: string, value: number): MetricPoint {
  return {
    date,
    value,
    reliability: "HIGH",
    protocolVersion: 1,
    resultId: `${date}-${value}`,
  };
}

describe("computeChange", () => {
  it("reports a lower time as an improvement for LOWER_IS_BETTER", () => {
    const change = computeChange(3.48, 3.31, "LOWER_IS_BETTER");
    expect(change).not.toBeNull();
    expect(change!.percent).toBeCloseTo(-4.885, 3);
    expect(change!.isImprovement).toBe(true);
  });

  it("reports a higher time as a regression for LOWER_IS_BETTER", () => {
    const change = computeChange(3.31, 3.48, "LOWER_IS_BETTER");
    expect(change!.percent).toBeCloseTo(5.136, 3);
    expect(change!.isImprovement).toBe(false);
  });

  it("reports a higher count as an improvement for HIGHER_IS_BETTER", () => {
    const change = computeChange(17, 64, "HIGHER_IS_BETTER");
    expect(change!.percent).toBeCloseTo(276.47, 2);
    expect(change!.isImprovement).toBe(true);
  });

  it("reports a lower count as a regression for HIGHER_IS_BETTER", () => {
    const change = computeChange(64, 17, "HIGHER_IS_BETTER");
    expect(change!.isImprovement).toBe(false);
  });

  it("never divides by a zero baseline", () => {
    expect(computeChange(0, 12, "HIGHER_IS_BETTER")).toBeNull();
  });

  it("treats an unchanged value as no improvement in either direction", () => {
    expect(computeChange(10, 10, "HIGHER_IS_BETTER")!.isImprovement).toBe(false);
    expect(computeChange(10, 10, "LOWER_IS_BETTER")!.isImprovement).toBe(false);
  });
});

describe("bestValue", () => {
  it("takes the maximum when higher is better", () => {
    expect(bestValue([12, 47, 31], "HIGHER_IS_BETTER")).toBe(47);
  });

  it("takes the minimum when lower is better", () => {
    expect(bestValue([3.48, 3.31, 3.6], "LOWER_IS_BETTER")).toBe(3.31);
  });

  it("returns null without any value", () => {
    expect(bestValue([], "HIGHER_IS_BETTER")).toBeNull();
  });
});

describe("computeTrend — insufficient data", () => {
  it("returns INSUFFICIENT_DATA with no observation", () => {
    expect(computeTrend([], "HIGHER_IS_BETTER").trend).toBe("INSUFFICIENT_DATA");
  });

  it("returns INSUFFICIENT_DATA with a single observation", () => {
    const result = computeTrend([point("2026-01-01", 20)], "HIGHER_IS_BETTER");
    expect(result.trend).toBe("INSUFFICIENT_DATA");
    expect(result.observations).toBe(1);
    expect(result.label).toBe("Insufficient data");
  });

  it("still refuses to conclude with two observations, however large the gap", () => {
    const result = computeTrend(
      [point("2026-01-01", 10), point("2026-02-01", 90)],
      "HIGHER_IS_BETTER",
    );
    expect(result.trend).toBe("INSUFFICIENT_DATA");
  });

  it("returns INSUFFICIENT_DATA when every measurement lands on the same day", () => {
    const result = computeTrend(
      [point("2026-01-01", 10), point("2026-01-01", 14), point("2026-01-01", 18)],
      "HIGHER_IS_BETTER",
    );
    expect(result.trend).toBe("INSUFFICIENT_DATA");
    expect(result.slopePerDay).toBeNull();
  });
});

describe("computeTrend — HIGHER_IS_BETTER", () => {
  const rising = [
    point("2026-01-01", 17),
    point("2026-02-01", 28),
    point("2026-03-01", 41),
    point("2026-04-01", 64),
  ];

  it("reads a rising series as progress", () => {
    const result = computeTrend(rising, "HIGHER_IS_BETTER");
    expect(result.trend).toBe("IMPROVING");
    expect(result.label).toBe("Likely progress");
    expect(result.slopePerDay).toBeGreaterThan(0);
  });

  it("reads the same rising series as a decline when lower is better", () => {
    expect(computeTrend(rising, "LOWER_IS_BETTER").trend).toBe("DECLINING");
  });

  it("reads a falling series as a decline", () => {
    const falling = [
      point("2026-01-01", 64),
      point("2026-02-01", 50),
      point("2026-03-01", 38),
      point("2026-04-01", 20),
    ];
    expect(computeTrend(falling, "HIGHER_IS_BETTER").trend).toBe("DECLINING");
  });
});

describe("computeTrend — LOWER_IS_BETTER", () => {
  it("reads falling sprint times as progress", () => {
    const times = [
      point("2026-01-01", 3.52),
      point("2026-02-01", 3.46),
      point("2026-03-01", 3.39),
      point("2026-04-01", 3.31),
    ];
    const result = computeTrend(times, "LOWER_IS_BETTER");
    expect(result.trend).toBe("IMPROVING");
    expect(result.slopePerDay).toBeLessThan(0);
  });

  it("reads rising sprint times as a decline", () => {
    const times = [
      point("2026-01-01", 3.31),
      point("2026-02-01", 3.4),
      point("2026-03-01", 3.48),
    ];
    expect(computeTrend(times, "LOWER_IS_BETTER").trend).toBe("DECLINING");
  });
});

describe("computeTrend — stability", () => {
  it("calls a flat series stable", () => {
    const flat = [
      point("2026-01-01", 3.4),
      point("2026-02-01", 3.4),
      point("2026-03-01", 3.4),
    ];
    expect(computeTrend(flat, "LOWER_IS_BETTER").trend).toBe("STABLE");
  });

  it("does not report noise below the threshold as progress", () => {
    const noisy = [
      point("2026-01-01", 3.4),
      point("2026-02-01", 3.42),
      point("2026-03-01", 3.39),
      point("2026-04-01", 3.41),
    ];
    expect(computeTrend(noisy, "LOWER_IS_BETTER").trend).toBe("STABLE");
  });

  it("uses only the last observations, so an old plateau does not mask recent progress", () => {
    const points = [
      ...Array.from({ length: 8 }, (_, i) =>
        point(`2026-01-0${i + 1}`.slice(0, 10), 20),
      ),
      point("2026-06-01", 24),
      point("2026-07-01", 28),
      point("2026-08-01", 33),
    ];
    expect(computeTrend(points, "HIGHER_IS_BETTER").trend).toBe("IMPROVING");
  });
});

describe("linearSlope", () => {
  it("recovers a known slope", () => {
    const slope = linearSlope([
      point("2026-01-01", 10),
      point("2026-01-11", 20),
      point("2026-01-21", 30),
    ]);
    expect(slope).toBeCloseTo(1, 6);
  });

  it("returns null without variance on the x axis", () => {
    expect(linearSlope([point("2026-01-01", 10), point("2026-01-01", 20)])).toBeNull();
  });
});

describe("metric keys", () => {
  it("keeps variants apart", () => {
    expect(metricKey("timed-run", "1000")).toBe("timed-run::1000");
    expect(metricKey("juggling")).toBe("juggling");
    expect(splitMetricKey("timed-run::2000")).toEqual({
      slug: "timed-run",
      variant: "2000",
    });
  });

  it("labels a run variant with its distance", () => {
    expect(metricLabel("timed-run::2000")).toBe("Timed Run — 2 km");
  });
});

function result(overrides: Partial<TestResult>): TestResult {
  return {
    id: overrides.id ?? "id",
    userId: "user",
    protocolSlug: "juggling",
    protocolVersion: 1,
    performedAt: "2026-01-01",
    value: 20,
    attempts: [20],
    detail: {},
    variant: null,
    measurementMethod: "MANUAL_COUNT",
    reliabilityLevel: "HIGH",
    conditions: null,
    notes: null,
    isBaseline: false,
    isDemo: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildMetricSeries", () => {
  it("uses the first result as baseline and the last as current", () => {
    const series = buildMetricSeries([
      result({ id: "c", performedAt: "2026-03-01", value: 41 }),
      result({ id: "a", performedAt: "2026-01-01", value: 17 }),
      result({ id: "b", performedAt: "2026-02-01", value: 28 }),
    ]);

    expect(series).toHaveLength(1);
    expect(series[0].baseline?.value).toBe(17);
    expect(series[0].latest.value).toBe(41);
    expect(series[0].best.value).toBe(41);
    expect(series[0].observations).toBe(3);
    expect(series[0].changeVsBaseline?.percent).toBeCloseTo(141.18, 2);
    expect(series[0].changeVsPrevious?.percent).toBeCloseTo(46.43, 2);
    expect(series[0].trend.trend).toBe("IMPROVING");
  });

  it("honours an explicitly flagged baseline", () => {
    const series = buildMetricSeries([
      result({ id: "a", performedAt: "2026-01-01", value: 10 }),
      result({ id: "b", performedAt: "2026-02-01", value: 20, isBaseline: true }),
      result({ id: "c", performedAt: "2026-03-01", value: 30 }),
    ]);
    expect(series[0].baseline?.value).toBe(20);
    expect(series[0].changeVsBaseline?.percent).toBeCloseTo(50, 6);
  });

  it("keeps a lower-is-better best as the minimum", () => {
    const series = buildMetricSeries([
      result({ id: "a", protocolSlug: "sprint-20m", performedAt: "2026-01-01", value: 3.52 }),
      result({ id: "b", protocolSlug: "sprint-20m", performedAt: "2026-02-01", value: 3.31 }),
      result({ id: "c", protocolSlug: "sprint-20m", performedAt: "2026-03-01", value: 3.38 }),
    ]);
    expect(series[0].best.value).toBe(3.31);
    expect(series[0].latest.value).toBe(3.38);
    expect(series[0].changeVsBaseline?.isImprovement).toBe(true);
  });

  it("separates variants of the same protocol", () => {
    const series = buildMetricSeries([
      result({ id: "a", protocolSlug: "timed-run", variant: "1000", value: 258 }),
      result({ id: "b", protocolSlug: "timed-run", variant: "2000", value: 540 }),
    ]);
    expect(series.map((s) => s.metricKey).sort()).toEqual([
      "timed-run::1000",
      "timed-run::2000",
    ]);
  });

  it("flags a protocol version change between baseline and latest", () => {
    const series = buildMetricSeries([
      result({ id: "a", performedAt: "2026-01-01", value: 17, protocolVersion: 1 }),
      result({ id: "b", performedAt: "2026-02-01", value: 30, protocolVersion: 2 }),
    ]);
    expect(series[0].versionMismatch).toBe(true);
  });

  it("flags mixed reliability across the series", () => {
    const series = buildMetricSeries([
      result({ id: "a", performedAt: "2026-01-01", reliabilityLevel: "HIGH" }),
      result({ id: "b", performedAt: "2026-02-01", reliabilityLevel: "LOW" }),
    ]);
    expect(series[0].mixedReliability).toBe(true);
    expect(series[0].reliability).toBe("LOW");
  });

  it("ignores results of unknown protocols instead of guessing", () => {
    expect(buildMetricSeries([result({ protocolSlug: "not-a-protocol" })])).toEqual([]);
  });

  it("gives a single result no baseline delta and no trend", () => {
    const series = buildMetricSeries([result({ id: "a", value: 17 })]);
    expect(series[0].changeVsBaseline).toBeNull();
    expect(series[0].trend.trend).toBe("INSUFFICIENT_DATA");
  });
});

describe("filterPointsByRange", () => {
  const now = new Date("2026-08-19T00:00:00Z");
  const points = [
    point("2025-06-01", 1),
    point("2026-03-01", 2),
    point("2026-07-25", 3),
    point("2026-08-15", 4),
  ];

  it("keeps everything on all time", () => {
    expect(filterPointsByRange(points, "all", now)).toHaveLength(4);
  });

  it("keeps only the last 30 days", () => {
    expect(filterPointsByRange(points, "30d", now).map((p) => p.value)).toEqual([3, 4]);
  });

  it("keeps the last year", () => {
    expect(filterPointsByRange(points, "1y", now).map((p) => p.value)).toEqual([2, 3, 4]);
  });
});
