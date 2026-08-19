import { TEST_PROTOCOLS, PROTOCOLS_BY_SLUG } from "./protocols";
import type { MetricWeight, Position, Role } from "./types";

/**
 * PositionMetricWeight — how relevant a metric is for a given position.
 *
 * The base matrix is the `positionRelevance` map carried by each protocol, so
 * there is a single source of truth. Roles then *shift* that base weight; they
 * never introduce a metric the position does not use at all.
 *
 * These weights are used only to order things (dashboard priorities, suggested
 * next tests, progress axes). V0.1 deliberately computes no overall rating.
 */

export type PositionMetricWeight = {
  position: Position;
  metricSlug: string;
  weight: MetricWeight;
};

export const WEIGHT_SCORE: Record<MetricWeight, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

const SCORE_TO_WEIGHT: MetricWeight[] = ["NONE", "LOW", "MEDIUM", "HIGH"];

export function positionMetricWeights(): PositionMetricWeight[] {
  const rows: PositionMetricWeight[] = [];
  for (const protocol of TEST_PROTOCOLS) {
    for (const [position, weight] of Object.entries(protocol.positionRelevance)) {
      rows.push({
        position: position as Position,
        metricSlug: protocol.slug,
        weight: weight as MetricWeight,
      });
    }
  }
  return rows;
}

export function positionWeight(position: Position, slug: string): MetricWeight {
  return PROTOCOLS_BY_SLUG[slug]?.positionRelevance[position] ?? "NONE";
}

/** Role profiles: +1 / -1 nudges applied on top of the position weight. */
export type RoleProfile = {
  role: Role;
  label: string;
  appliesTo: Position[];
  description: string;
  emphasis: Partial<Record<string, number>>;
};

export const ROLE_PROFILES: RoleProfile[] = [
  {
    role: "GENERALIST",
    label: "Generalist",
    appliesTo: [
      "GK", "CB", "RB", "LB", "RWB", "LWB", "DM", "CM", "AM", "RW", "LW", "ST",
    ],
    description: "No role bias. Metrics are ordered by position relevance only.",
    emphasis: {},
  },
  {
    role: "ATTACKING_FULLBACK",
    label: "Attacking Full-back",
    appliesTo: ["RB", "LB", "RWB", "LWB"],
    description:
      "Overlaps, delivers crosses, carries the ball forward. Speed, crossing and repeatable running are the priorities.",
    emphasis: {
      "sprint-10m": 1,
      "sprint-20m": 1,
      "sprint-30m": 1,
      "crossing-accuracy": 1,
      "slalom-ball-control": 1,
      "passing-accuracy-weak-foot": 1,
      "timed-run": 1,
      juggling: -1,
      "finishing-accuracy": -1,
    },
  },
  {
    role: "COMPLETE_FULLBACK",
    label: "Complete Full-back",
    appliesTo: ["RB", "LB", "RWB", "LWB"],
    description:
      "Balanced profile: defends, builds and joins the attack. Weights stay close to the raw position weights.",
    emphasis: {
      "passing-accuracy-strong-foot": 1,
      "passing-accuracy-weak-foot": 1,
      "sprint-20m": 1,
      "timed-run": 1,
    },
  },
  {
    role: "DEFENSIVE_FULLBACK",
    label: "Defensive Full-back",
    appliesTo: ["RB", "LB", "RWB", "LWB"],
    description: "Priority on defending and safe build-up. Planned for a later version.",
    emphasis: {},
  },
  {
    role: "INVERTED_FULLBACK",
    label: "Inverted Full-back",
    appliesTo: ["RB", "LB", "RWB", "LWB"],
    description: "Steps into midfield in possession. Planned for a later version.",
    emphasis: {},
  },
  {
    role: "WINGBACK",
    label: "Wing-back",
    appliesTo: ["RWB", "LWB", "RB", "LB"],
    description: "Full-flank coverage in a back five. Planned for a later version.",
    emphasis: {},
  },
];

/** Roles fully specified in V0.1 — the others are declared but not yet weighted. */
export const IMPLEMENTED_ROLES: Role[] = [
  "GENERALIST",
  "ATTACKING_FULLBACK",
  "COMPLETE_FULLBACK",
];

export function roleProfile(role: Role): RoleProfile {
  return ROLE_PROFILES.find((r) => r.role === role) ?? ROLE_PROFILES[0];
}

export function rolesForPosition(position: Position): RoleProfile[] {
  return ROLE_PROFILES.filter((r) => r.appliesTo.includes(position));
}

/**
 * Effective weight of a metric for a position + role pair.
 * A metric irrelevant to the position (NONE) stays irrelevant whatever the role.
 */
export function effectiveWeight(
  position: Position,
  role: Role,
  slug: string,
): MetricWeight {
  const base = positionWeight(position, slug);
  if (base === "NONE") return "NONE";
  const nudge = roleProfile(role).emphasis[slug] ?? 0;
  const score = Math.max(1, Math.min(3, WEIGHT_SCORE[base] + nudge));
  return SCORE_TO_WEIGHT[score];
}

export function effectiveWeightScore(
  position: Position,
  role: Role,
  slug: string,
): number {
  return WEIGHT_SCORE[effectiveWeight(position, role, slug)];
}

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Goalkeeper",
  CB: "Centre-back",
  RB: "Right-back",
  LB: "Left-back",
  RWB: "Right wing-back",
  LWB: "Left wing-back",
  DM: "Defensive midfielder",
  CM: "Central midfielder",
  AM: "Attacking midfielder",
  RW: "Right winger",
  LW: "Left winger",
  ST: "Striker",
};
