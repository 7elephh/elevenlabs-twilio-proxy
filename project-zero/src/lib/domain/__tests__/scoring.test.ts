import { describe, expect, it } from "vitest";

import { PROTOCOLS_BY_SLUG } from "../protocols";
import { scoreResult, validateRawInput } from "../scoring";

const juggling = PROTOCOLS_BY_SLUG["juggling"];
const slalom = PROTOCOLS_BY_SLUG["slalom-ball-control"];
const crossing = PROTOCOLS_BY_SLUG["crossing-accuracy"];
const finishing = PROTOCOLS_BY_SLUG["finishing-accuracy"];
const sprint = PROTOCOLS_BY_SLUG["sprint-20m"];
const run = PROTOCOLS_BY_SLUG["timed-run"];
const passing = PROTOCOLS_BY_SLUG["passing-accuracy-weak-foot"];

describe("scoreResult", () => {
  it("keeps the best juggling attempt", () => {
    const scored = scoreResult(juggling, { attempts: [41, 64, 52], extras: {} });
    expect(scored.value).toBe(64);
    expect(scored.detail.mean).toBeCloseTo(52.33, 2);
  });

  it("keeps the fastest sprint and stores the mean", () => {
    const scored = scoreResult(sprint, { attempts: [3.44, 3.31, 3.38], extras: {} });
    expect(scored.value).toBe(3.31);
    expect(scored.detail.mean).toBeCloseTo(3.38, 2);
  });

  it("adds the cone penalty to the best slalom time", () => {
    const scored = scoreResult(slalom, {
      attempts: [14.2, 13.4, 13.9],
      extras: { cone_faults: 2, penalty_seconds: 0.5 },
    });
    expect(scored.value).toBe(14.4);
    expect(scored.detail.best_raw_time).toBe(13.4);
  });

  it("sums crossing zones into a score out of 24", () => {
    const scored = scoreResult(crossing, {
      attempts: [],
      extras: { near_post: 6, central: 5, far_post: 5 },
    });
    expect(scored.value).toBe(16);
    expect(scored.detail.near_post).toBe(6);
    expect(scored.detail.max_score).toBe(24);
  });

  it("stores goals, on target, misses and attempts for finishing", () => {
    const scored = scoreResult(finishing, {
      attempts: [8],
      extras: { shots_on_target: 6, misses: 6 },
    });
    expect(scored.value).toBe(8);
    expect(scored.detail).toMatchObject({
      goals: 8,
      shots_on_target: 6,
      misses: 6,
      attempts: 20,
    });
  });

  it("derives pace and marks the distance as the variant of a run", () => {
    const scored = scoreResult(run, {
      attempts: [240],
      extras: { distance_m: 1000 },
    });
    expect(scored.variant).toBe("1000");
    expect(scored.detail.pace_s_per_km).toBe(240);
    expect(scored.detail.speed_kmh).toBe(15);
  });

  it("adds a success rate to a scored-out-of-20 test", () => {
    const scored = scoreResult(passing, { attempts: [11], extras: {} });
    expect(scored.value).toBe(11);
    expect(scored.detail.success_rate_pct).toBe(55);
  });
});

describe("validateRawInput", () => {
  it("rejects an empty attempt list", () => {
    expect(validateRawInput(juggling, { attempts: [], extras: {} })).toMatch(/at least one/i);
  });

  it("rejects a passing score above the maximum", () => {
    expect(validateRawInput(passing, { attempts: [21], extras: {} })).toMatch(/exceed/i);
  });

  it("rejects finishing counts that do not add up to 20", () => {
    const problem = validateRawInput(finishing, {
      attempts: [8],
      extras: { shots_on_target: 6, misses: 5 },
    });
    expect(problem).toMatch(/20 strikes/);
  });

  it("accepts finishing counts that add up to 20, including zero goals", () => {
    expect(
      validateRawInput(finishing, {
        attempts: [0],
        extras: { shots_on_target: 8, misses: 12 },
      }),
    ).toBeNull();
  });

  it("rejects a crossing zone above 8", () => {
    expect(
      validateRawInput(crossing, { attempts: [], extras: { near_post: 9 } }),
    ).toMatch(/between 0 and 8/);
  });

  it("accepts a valid juggling attempt set", () => {
    expect(validateRawInput(juggling, { attempts: [17, 22, 19], extras: {} })).toBeNull();
  });
});
