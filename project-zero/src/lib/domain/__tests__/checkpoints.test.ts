import { describe, expect, it } from "vitest";

import { buildCheckpoint, nextCheckpointDue } from "../checkpoints";
import type { Checkpoint, TestResult, TrainingSession } from "../types";

function session(
  date: string,
  minutes: number,
  type: TrainingSession["sessionType"] = "TEAM_TRAINING",
): TrainingSession {
  return {
    id: `${date}-${type}`,
    userId: "user",
    date,
    sessionType: type,
    durationMinutes: minutes,
    position: null,
    rpe: null,
    notes: null,
    isDemo: false,
    createdAt: `${date}T00:00:00Z`,
  };
}

function result(slug: string, date: string, value: number, id: string): TestResult {
  return {
    id,
    userId: "user",
    protocolSlug: slug,
    protocolVersion: 1,
    performedAt: date,
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
    createdAt: `${date}T00:00:00Z`,
  };
}

describe("buildCheckpoint", () => {
  const sessions = [
    session("2026-01-10", 90),
    session("2026-02-10", 60, "INDIVIDUAL"),
    session("2026-02-20", 80, "MATCH"),
    session("2026-03-05", 90),
  ];
  const results = [
    result("juggling", "2026-01-05", 17, "j1"),
    result("juggling", "2026-02-05", 30, "j2"),
    result("juggling", "2026-03-01", 48, "j3"),
    result("sprint-20m", "2026-01-05", 3.52, "s1"),
    result("sprint-20m", "2026-03-01", 3.35, "s2"),
  ];

  it("counts only the sessions inside the window", () => {
    const checkpoint = buildCheckpoint({
      userId: "user",
      date: "2026-03-31",
      kind: "SIMPLE",
      sessions,
      results,
      previousCheckpointDate: "2026-02-01",
    });
    expect(checkpoint.sessionsSincePrevious).toBe(3);
    expect(checkpoint.trainingHoursSincePrevious).toBeCloseTo(3.8, 1);
    expect(checkpoint.matchesSincePrevious).toBe(1);
  });

  it("ignores results recorded after the checkpoint date", () => {
    const checkpoint = buildCheckpoint({
      userId: "user",
      date: "2026-02-06",
      kind: "SIMPLE",
      sessions,
      results,
      previousCheckpointDate: null,
    });
    const juggling = checkpoint.metrics.find((m) => m.protocolSlug === "juggling");
    expect(juggling?.latestValue).toBe(30);
    expect(juggling?.observations).toBe(2);
    expect(juggling?.trend).toBe("INSUFFICIENT_DATA");
  });

  it("compares against the baseline and the previous checkpoint separately", () => {
    const checkpoint = buildCheckpoint({
      userId: "user",
      date: "2026-03-31",
      kind: "FULL",
      sessions,
      results,
      previousCheckpointDate: "2026-02-10",
    });
    const juggling = checkpoint.metrics.find((m) => m.protocolSlug === "juggling")!;
    expect(juggling.baselineValue).toBe(17);
    expect(juggling.previousValue).toBe(30);
    expect(juggling.changeVsBaselinePct).toBeCloseTo(182.35, 2);
    expect(juggling.changeVsPreviousPct).toBeCloseTo(60, 6);
    expect(juggling.trend).toBe("IMPROVING");
  });

  it("keeps improvement_direction on each metric summary", () => {
    const checkpoint = buildCheckpoint({
      userId: "user",
      date: "2026-03-31",
      kind: "SIMPLE",
      sessions,
      results,
      previousCheckpointDate: null,
    });
    const sprint = checkpoint.metrics.find((m) => m.protocolSlug === "sprint-20m")!;
    expect(sprint.improvementDirection).toBe("LOWER_IS_BETTER");
    expect(sprint.changeVsBaselinePct).toBeLessThan(0);
    expect(sprint.bestValue).toBe(3.35);
  });
});

describe("nextCheckpointDue", () => {
  const now = new Date("2026-03-01T00:00:00Z");

  it("returns nothing without a baseline", () => {
    expect(nextCheckpointDue(null, [], now)).toBeNull();
  });

  it("counts 30 days from the baseline for the first simple checkpoint", () => {
    const next = nextCheckpointDue("2026-02-20", [], now);
    expect(next?.kind).toBe("SIMPLE");
    expect(next?.dueDate).toBe("2026-03-22");
    expect(next?.overdue).toBe(false);
  });

  it("marks an overdue checkpoint", () => {
    const next = nextCheckpointDue("2025-12-01", [], now);
    expect(next?.overdue).toBe(true);
    expect(next?.daysRemaining).toBeLessThan(0);
  });

  it("counts from the last checkpoint of the same kind", () => {
    const checkpoints: Checkpoint[] = [
      {
        id: "c1",
        userId: "user",
        date: "2026-02-15",
        kind: "SIMPLE",
        sessionsSincePrevious: 0,
        trainingHoursSincePrevious: 0,
        matchesSincePrevious: 0,
        metrics: [],
        notes: null,
        isDemo: false,
        createdAt: "2026-02-15T00:00:00Z",
      },
    ];
    const next = nextCheckpointDue("2026-01-01", checkpoints, now);
    expect(next?.kind).toBe("SIMPLE");
    expect(next?.dueDate).toBe("2026-03-17");
  });
});
