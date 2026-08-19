import { describe, expect, it } from "vitest";

import { effectiveWeight, positionWeight, rolesForPosition } from "../positions";
import { computePriorities, currentPriorities } from "../priorities";
import { buildMetricSeries } from "../progress";
import type { TestResult } from "../types";

const NOW = new Date("2026-08-19T00:00:00Z");

function result(slug: string, performedAt: string, value: number, id: string): TestResult {
  return {
    id,
    userId: "user",
    protocolSlug: slug,
    protocolVersion: 1,
    performedAt,
    value,
    attempts: [value],
    detail: {},
    variant: null,
    measurementMethod: "MANUAL_COUNT",
    reliabilityLevel: "HIGH",
    conditions: null,
    notes: null,
    isBaseline: false,
    isDemo: false,
    createdAt: `${performedAt}T00:00:00Z`,
  };
}

describe("position and role weights", () => {
  it("weights crossing highly for a right-back and not at all for a centre-back", () => {
    expect(positionWeight("RB", "crossing-accuracy")).toBe("HIGH");
    expect(positionWeight("CB", "crossing-accuracy")).toBe("NONE");
  });

  it("lets an attacking full-back role lift a medium metric", () => {
    expect(positionWeight("RB", "slalom-ball-control")).toBe("MEDIUM");
    expect(effectiveWeight("RB", "ATTACKING_FULLBACK", "slalom-ball-control")).toBe("HIGH");
  });

  it("never resurrects a metric the position does not use", () => {
    expect(effectiveWeight("CB", "ATTACKING_FULLBACK", "crossing-accuracy")).toBe("NONE");
  });

  it("keeps a role-neutral profile on the raw position weights", () => {
    expect(effectiveWeight("RB", "GENERALIST", "juggling")).toBe(
      positionWeight("RB", "juggling"),
    );
  });

  it("offers full-back roles for full-back positions", () => {
    const roles = rolesForPosition("RB").map((r) => r.role);
    expect(roles).toContain("ATTACKING_FULLBACK");
    expect(roles).toContain("COMPLETE_FULLBACK");
  });
});

describe("computePriorities", () => {
  it("excludes metrics irrelevant to the position", () => {
    const keys = computePriorities({
      position: "CB",
      role: "GENERALIST",
      series: [],
      now: NOW,
    }).map((i) => i.protocol.slug);
    expect(keys).not.toContain("crossing-accuracy");
  });

  it("puts a never-measured high-weight metric at the top", () => {
    const top = currentPriorities({
      position: "RB",
      role: "ATTACKING_FULLBACK",
      series: [],
      now: NOW,
    });
    expect(top).toHaveLength(3);
    expect(top[0].daysSinceLastTest).toBeNull();
    expect(top[0].weight).toBe("HIGH");
    expect(top[0].reason).toMatch(/Never measured/);
  });

  it("ranks a stagnating metric above an improving one of equal weight", () => {
    const series = buildMetricSeries([
      result("sprint-10m", "2026-06-01", 2.05, "a1"),
      result("sprint-10m", "2026-07-01", 2.05, "a2"),
      result("sprint-10m", "2026-08-01", 2.05, "a3"),
      result("sprint-20m", "2026-06-01", 3.52, "b1"),
      result("sprint-20m", "2026-07-01", 3.42, "b2"),
      result("sprint-20m", "2026-08-01", 3.31, "b3"),
    ]);
    const items = computePriorities({
      position: "RB",
      role: "ATTACKING_FULLBACK",
      series,
      now: NOW,
    });
    const flat = items.findIndex((i) => i.protocol.slug === "sprint-10m");
    const improving = items.findIndex((i) => i.protocol.slug === "sprint-20m");
    expect(flat).toBeLessThan(improving);
  });

  it("returns at most three dashboard priorities", () => {
    expect(
      currentPriorities({ position: "RB", role: "COMPLETE_FULLBACK", series: [], now: NOW }),
    ).toHaveLength(3);
  });
});
