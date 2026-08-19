/**
 * PROJECT ZERO — domain model.
 *
 * Every measurable thing in the app carries three qualifiers that must never be
 * dropped when the value travels to the UI:
 *   - measurement_type   (OBJECTIVE | SEMI_OBJECTIVE | SUBJECTIVE)
 *   - reliability_level  (HIGH | MEDIUM | LOW)
 *   - improvement_direction (HIGHER_IS_BETTER | LOWER_IS_BETTER)
 */

export const MEASUREMENT_TYPES = ["OBJECTIVE", "SEMI_OBJECTIVE", "SUBJECTIVE"] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const RELIABILITY_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number];

export const IMPROVEMENT_DIRECTIONS = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER"] as const;
export type ImprovementDirection = (typeof IMPROVEMENT_DIRECTIONS)[number];

export const TEST_CATEGORIES = ["TECHNICAL", "PHYSICAL", "POSITIONAL"] as const;
export type TestCategory = (typeof TEST_CATEGORIES)[number];

export const SESSION_TYPES = ["INDIVIDUAL", "TEAM_TRAINING", "MATCH", "PHYSICAL"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const MEASUREMENT_METHODS = [
  "MANUAL_COUNT",
  "PHONE_VIDEO",
  "STOPWATCH",
  "WEARABLE",
  "OTHER",
] as const;
export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number];

export const POSITIONS = [
  "GK",
  "CB",
  "RB",
  "LB",
  "RWB",
  "LWB",
  "DM",
  "CM",
  "AM",
  "RW",
  "LW",
  "ST",
] as const;
export type Position = (typeof POSITIONS)[number];

export const ROLES = [
  "DEFENSIVE_FULLBACK",
  "ATTACKING_FULLBACK",
  "COMPLETE_FULLBACK",
  "INVERTED_FULLBACK",
  "WINGBACK",
  "GENERALIST",
] as const;
export type Role = (typeof ROLES)[number];

export const WEIGHTS = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
export type MetricWeight = (typeof WEIGHTS)[number];

export const TRENDS = ["IMPROVING", "STABLE", "DECLINING", "INSUFFICIENT_DATA"] as const;
export type Trend = (typeof TRENDS)[number];

export const CHECKPOINT_KINDS = ["SIMPLE", "FULL"] as const;
export type CheckpointKind = (typeof CHECKPOINT_KINDS)[number];

/** Cadence, in days, of each checkpoint kind. */
export const CHECKPOINT_INTERVAL_DAYS: Record<CheckpointKind, number> = {
  SIMPLE: 30,
  FULL: 90,
};

/** A field the START TEST flow asks for, beyond the raw attempt values. */
export type ProtocolInputField = {
  key: string;
  label: string;
  type: "number" | "select";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  help?: string;
};

export type TestProtocol = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: TestCategory;
  /** Relevance of this protocol per position. Missing position => NONE. */
  positionRelevance: Partial<Record<Position, MetricWeight>>;
  instructions: string[];
  equipment: string[];
  attempts: number;
  restSeconds: number;
  unit: string;
  measurementType: MeasurementType;
  improvementDirection: ImprovementDirection;
  defaultReliability: ReliabilityLevel;
  /** Bumped whenever the protocol changes in a way that breaks comparability. */
  protocolVersion: number;
  active: boolean;
  /** How the headline value is derived from the recorded attempts. */
  aggregation: "BEST" | "SUM" | "SINGLE";
  /** Label shown above the attempt inputs, e.g. "Attempt time (s)". */
  attemptLabel: string;
  /** Extra structured fields (zones, distance, ...). */
  extraFields?: ProtocolInputField[];
  /** Results of the same protocol are only comparable within the same variant. */
  variantField?: string;
  maxValue?: number;
  notes?: string;
};

export type PlayerProfile = {
  id: string;
  userId: string;
  displayName: string;
  primaryPosition: Position;
  secondaryPositions: Position[];
  preferredRole: Role;
  baselineDate: string | null;
  isDemo: boolean;
  createdAt: string;
};

export type TrainingSession = {
  id: string;
  userId: string;
  date: string;
  sessionType: SessionType;
  durationMinutes: number;
  position: Position | null;
  rpe: number | null;
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
};

export type TestResult = {
  id: string;
  userId: string;
  protocolSlug: string;
  protocolVersion: number;
  performedAt: string;
  /** Headline value of the protocol, in `TestProtocol.unit`. */
  value: number;
  /** Raw per-attempt values, kept so the aggregation stays auditable. */
  attempts: number[];
  /** Protocol-specific breakdown (zones, goals/misses, distance, pace...). */
  detail: Record<string, number | string>;
  /** Set when several distances/variants of one protocol are not comparable. */
  variant: string | null;
  measurementMethod: MeasurementMethod;
  reliabilityLevel: ReliabilityLevel;
  conditions: string | null;
  notes: string | null;
  isBaseline: boolean;
  isDemo: boolean;
  createdAt: string;
};

export type CheckpointMetricSummary = {
  metricKey: string;
  protocolSlug: string;
  label: string;
  unit: string;
  improvementDirection: ImprovementDirection;
  reliability: ReliabilityLevel;
  baselineValue: number | null;
  previousValue: number | null;
  latestValue: number;
  bestValue: number;
  changeVsBaselinePct: number | null;
  changeVsPreviousPct: number | null;
  trend: Trend;
  observations: number;
};

export type Checkpoint = {
  id: string;
  userId: string;
  date: string;
  kind: CheckpointKind;
  sessionsSincePrevious: number;
  trainingHoursSincePrevious: number;
  matchesSincePrevious: number;
  metrics: CheckpointMetricSummary[];
  notes: string | null;
  isDemo: boolean;
  createdAt: string;
};
