/**
 * PROJECT ZERO — demonstration data.
 *
 * Every row created here is flagged `is_demo`, and `npm run seed:clear` removes
 * exactly those rows. The numbers describe a plausible late-starting right-back
 * over five months; they are illustrative, not a benchmark.
 *
 *   npm run seed         # insert demo data
 *   npm run seed:clear   # delete every demo row
 */
import "dotenv/config";

import { createAdminStore } from "../src/lib/data/admin";
import { buildCheckpoint } from "../src/lib/domain/checkpoints";
import { PROTOCOLS_BY_SLUG } from "../src/lib/domain/protocols";
import { scoreResult } from "../src/lib/domain/scoring";
import type { MeasurementMethod, SessionType } from "../src/lib/domain/types";

const DAYS = 150;

/** Deterministic PRNG so the demo dataset is identical on every machine. */
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260819);

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Linear progression from `from` to `to` with a bit of session-to-session noise. */
function progress(from: number, to: number, ratio: number, noise: number): number {
  const value = from + (to - from) * ratio;
  return value + (random() - 0.5) * 2 * noise;
}

type Measurement = {
  slug: string;
  method: MeasurementMethod;
  /** Test dates, as "days ago". */
  offsets: number[];
  build: (ratio: number) => { attempts: number[]; extras: Record<string, number> };
};

const MEASUREMENTS: Measurement[] = [
  {
    slug: "juggling",
    method: "MANUAL_COUNT",
    offsets: [150, 120, 90, 60, 30, 5],
    build: (r) => ({
      attempts: [
        Math.round(progress(14, 55, r, 3)),
        Math.round(progress(17, 64, r, 4)),
        Math.round(progress(12, 58, r, 4)),
      ],
      extras: {},
    }),
  },
  {
    slug: "sprint-10m",
    method: "PHONE_VIDEO",
    offsets: [150, 105, 60, 20],
    build: (r) => ({
      attempts: [
        Number(progress(2.09, 1.99, r, 0.03).toFixed(2)),
        Number(progress(2.05, 1.96, r, 0.03).toFixed(2)),
        Number(progress(2.07, 1.98, r, 0.03).toFixed(2)),
      ],
      extras: {},
    }),
  },
  {
    slug: "sprint-20m",
    method: "PHONE_VIDEO",
    offsets: [150, 105, 60, 20],
    build: (r) => ({
      attempts: [
        Number(progress(3.52, 3.36, r, 0.04).toFixed(2)),
        Number(progress(3.48, 3.31, r, 0.04).toFixed(2)),
        Number(progress(3.55, 3.35, r, 0.04).toFixed(2)),
      ],
      extras: {},
    }),
  },
  {
    slug: "sprint-30m",
    method: "PHONE_VIDEO",
    offsets: [150, 60, 20],
    build: (r) => ({
      attempts: [
        Number(progress(4.68, 4.50, r, 0.05).toFixed(2)),
        Number(progress(4.62, 4.45, r, 0.05).toFixed(2)),
        Number(progress(4.71, 4.52, r, 0.05).toFixed(2)),
      ],
      extras: {},
    }),
  },
  {
    slug: "passing-accuracy-strong-foot",
    method: "MANUAL_COUNT",
    offsets: [150, 110, 70, 30, 4],
    build: (r) => ({ attempts: [Math.round(progress(12, 17, r, 1))], extras: {} }),
  },
  {
    slug: "passing-accuracy-weak-foot",
    method: "MANUAL_COUNT",
    offsets: [150, 110, 70, 30, 4],
    build: (r) => ({ attempts: [Math.round(progress(6, 12, r, 1))], extras: {} }),
  },
  {
    slug: "crossing-accuracy",
    method: "MANUAL_COUNT",
    offsets: [148, 100, 55, 12],
    build: (r) => ({
      attempts: [],
      extras: {
        near_post: Math.round(progress(3, 6, r, 1)),
        central: Math.round(progress(4, 5, r, 1)),
        far_post: Math.round(progress(3, 5, r, 1)),
      },
    }),
  },
  {
    slug: "finishing-accuracy",
    method: "MANUAL_COUNT",
    offsets: [148, 80, 25],
    build: (r) => {
      const goals = Math.round(progress(4, 8, r, 1));
      const onTarget = Math.round(progress(5, 6, r, 1));
      return {
        attempts: [goals],
        extras: { shots_on_target: onTarget, misses: 20 - goals - onTarget },
      };
    },
  },
  {
    slug: "slalom-ball-control",
    method: "STOPWATCH",
    offsets: [149, 95, 45, 8],
    build: (r) => ({
      attempts: [
        Number(progress(15.4, 13.9, r, 0.3).toFixed(2)),
        Number(progress(14.8, 13.4, r, 0.3).toFixed(2)),
        Number(progress(15.1, 13.7, r, 0.3).toFixed(2)),
      ],
      extras: { cone_faults: r > 0.5 ? 0 : 1, penalty_seconds: 0.5 },
    }),
  },
  {
    slug: "timed-run",
    method: "STOPWATCH",
    offsets: [147, 90, 35],
    build: (r) => ({
      attempts: [Number(progress(258, 232, r, 4).toFixed(1))],
      extras: { distance_m: 1000 },
    }),
  },
];

const SESSION_PLAN: { type: SessionType; minutes: number; weekday: number }[] = [
  { type: "TEAM_TRAINING", minutes: 90, weekday: 2 },
  { type: "TEAM_TRAINING", minutes: 90, weekday: 4 },
  { type: "INDIVIDUAL", minutes: 45, weekday: 1 },
  { type: "PHYSICAL", minutes: 50, weekday: 5 },
  { type: "MATCH", minutes: 80, weekday: 0 },
];

async function main() {
  const clear = process.argv.includes("--clear");
  const { store, userId } = createAdminStore();

  if (clear) {
    const counts = await store.clearDemoData(userId);
    console.log(
      `Demo data removed (${store.mode}): ${counts.sessions} sessions, ${counts.results} results, ${counts.checkpoints} checkpoints.`,
    );
    return;
  }

  console.log(`Seeding demo data into the ${store.mode} store for user ${userId}…`);

  await store.saveProfile(userId, {
    displayName: "Demo Player",
    primaryPosition: "RB",
    secondaryPositions: ["RWB", "RW"],
    preferredRole: "ATTACKING_FULLBACK",
  });

  // --- sessions ------------------------------------------------------------
  let sessionCount = 0;
  for (let daysAgo = DAYS; daysAgo >= 0; daysAgo -= 1) {
    const date = isoDaysAgo(daysAgo);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const planned = SESSION_PLAN.find((p) => p.weekday === weekday);
    // Roughly one session in eight is skipped: injury, travel, life.
    if (!planned || random() < 0.12) continue;

    await store.createSession(
      userId,
      {
        date,
        sessionType: planned.type,
        durationMinutes: planned.minutes + Math.round((random() - 0.5) * 20),
        position: planned.type === "MATCH" ? "RB" : null,
        rpe: 4 + Math.round(random() * 5),
        notes: null,
      },
      true,
    );
    sessionCount += 1;
  }

  // --- test results --------------------------------------------------------
  type Pending = { daysAgo: number; measurement: Measurement; ratio: number };
  const pending: Pending[] = [];
  for (const measurement of MEASUREMENTS) {
    const sorted = [...measurement.offsets].sort((a, b) => b - a);
    sorted.forEach((daysAgo, index) => {
      pending.push({
        daysAgo,
        measurement,
        ratio: sorted.length === 1 ? 0 : index / (sorted.length - 1),
      });
    });
  }
  pending.sort((a, b) => b.daysAgo - a.daysAgo);

  for (const { daysAgo, measurement, ratio } of pending) {
    const protocol = PROTOCOLS_BY_SLUG[measurement.slug];
    const raw = measurement.build(ratio);
    const scored = scoreResult(protocol, raw);
    await store.createResult(
      userId,
      {
        protocolSlug: protocol.slug,
        protocolVersion: protocol.protocolVersion,
        performedAt: isoDaysAgo(daysAgo),
        value: scored.value,
        attempts: scored.attempts,
        detail: scored.detail,
        variant: scored.variant,
        measurementMethod: measurement.method,
        reliabilityLevel: protocol.defaultReliability,
        conditions: null,
        notes: null,
      },
      true,
    );
  }

  await store.setBaselineDate(userId, isoDaysAgo(DAYS));

  // --- checkpoints ---------------------------------------------------------
  const sessions = await store.listSessions(userId);
  const results = await store.listResults(userId);
  let previousDate: string | null = null;
  // 30 days after the baseline, then the 90-day review, then a recent check.
  const CHECKPOINTS: { daysAgo: number; kind: "SIMPLE" | "FULL" }[] = [
    { daysAgo: 120, kind: "SIMPLE" },
    { daysAgo: 60, kind: "FULL" },
    { daysAgo: 20, kind: "SIMPLE" },
  ];
  for (const { daysAgo, kind } of CHECKPOINTS) {
    const draft = buildCheckpoint({
      userId,
      date: isoDaysAgo(daysAgo),
      kind,
      sessions,
      results,
      previousCheckpointDate: previousDate,
      notes: "Demo checkpoint",
      isDemo: true,
    });
    await store.createCheckpoint(userId, draft);
    previousDate = draft.date;
  }

  console.log(
    `Done: ${sessionCount} sessions, ${pending.length} test results, ${CHECKPOINTS.length} checkpoints — all flagged DEMO.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
