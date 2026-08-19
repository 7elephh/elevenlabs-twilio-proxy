import type {
  Checkpoint,
  CheckpointKind,
  MeasurementMethod,
  PlayerProfile,
  Position,
  ReliabilityLevel,
  Role,
  SessionType,
  TestResult,
  TrainingSession,
} from "@/lib/domain/types";
import type { CheckpointDraft } from "@/lib/domain/checkpoints";

export type ProfileInput = {
  displayName: string;
  primaryPosition: Position;
  secondaryPositions: Position[];
  preferredRole: Role;
};

export type SessionInput = {
  date: string;
  sessionType: SessionType;
  durationMinutes: number;
  position?: Position | null;
  rpe?: number | null;
  notes?: string | null;
};

export type TestResultInput = {
  protocolSlug: string;
  protocolVersion: number;
  performedAt: string;
  value: number;
  attempts: number[];
  detail: Record<string, number | string>;
  variant?: string | null;
  measurementMethod: MeasurementMethod;
  reliabilityLevel: ReliabilityLevel;
  conditions?: string | null;
  notes?: string | null;
  isBaseline?: boolean;
};

export type CheckpointInput = CheckpointDraft & { kind: CheckpointKind };

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Persistence boundary.
 *
 * Two implementations ship with V0.1: Supabase (the real target) and a local
 * file store used when no Supabase project is configured, so the app is
 * runnable and seedable end to end without credentials. No user id is ever
 * hard-coded — both implementations resolve it from `getCurrentUser()`.
 */
export interface DataStore {
  readonly mode: "supabase" | "local";

  getProfile(userId: string): Promise<PlayerProfile | null>;
  saveProfile(userId: string, input: ProfileInput): Promise<PlayerProfile>;
  setBaselineDate(userId: string, date: string | null): Promise<void>;

  listSessions(userId: string): Promise<TrainingSession[]>;
  createSession(
    userId: string,
    input: SessionInput,
    isDemo?: boolean,
  ): Promise<TrainingSession>;
  deleteSession(userId: string, id: string): Promise<void>;

  listResults(userId: string): Promise<TestResult[]>;
  createResult(
    userId: string,
    input: TestResultInput,
    isDemo?: boolean,
  ): Promise<TestResult>;
  deleteResult(userId: string, id: string): Promise<void>;

  listCheckpoints(userId: string): Promise<Checkpoint[]>;
  createCheckpoint(userId: string, input: CheckpointInput): Promise<Checkpoint>;
  deleteCheckpoint(userId: string, id: string): Promise<void>;

  /** Removes every row flagged is_demo for this user. */
  clearDemoData(userId: string): Promise<{
    sessions: number;
    results: number;
    checkpoints: number;
  }>;
}
