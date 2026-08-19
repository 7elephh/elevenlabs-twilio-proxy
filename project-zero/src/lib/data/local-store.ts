import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  Checkpoint,
  PlayerProfile,
  TestResult,
  TrainingSession,
} from "@/lib/domain/types";
import type {
  CheckpointInput,
  DataStore,
  ProfileInput,
  SessionInput,
  TestResultInput,
} from "./store";

/**
 * File-backed store used when Supabase is not configured.
 *
 * It exists so the app, the seed and the whole flow can be exercised without
 * credentials. It mirrors the Supabase behaviour, including user scoping — the
 * rows are keyed by user id exactly as they are in Postgres.
 */

type Db = {
  profiles: PlayerProfile[];
  sessions: TrainingSession[];
  results: TestResult[];
  checkpoints: Checkpoint[];
};

const EMPTY: Db = { profiles: [], sessions: [], results: [], checkpoints: [] };

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function read(): Promise<Db> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Db>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Serialises writers so two concurrent server actions cannot clobber the file. */
async function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await read();
    const result = await fn(db);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    return result;
  });
  writeChain = run.catch(() => undefined);
  return run;
}

function defaultProfile(userId: string): PlayerProfile {
  return {
    id: randomUUID(),
    userId,
    displayName: "Player",
    primaryPosition: "RB",
    secondaryPositions: [],
    preferredRole: "GENERALIST",
    baselineDate: null,
    isDemo: false,
    createdAt: new Date().toISOString(),
  };
}

export class LocalStore implements DataStore {
  readonly mode = "local" as const;

  async getProfile(userId: string): Promise<PlayerProfile | null> {
    const db = await read();
    return db.profiles.find((p) => p.userId === userId) ?? null;
  }

  async saveProfile(userId: string, input: ProfileInput): Promise<PlayerProfile> {
    return mutate((db) => {
      const existing = db.profiles.find((p) => p.userId === userId);
      const next: PlayerProfile = { ...(existing ?? defaultProfile(userId)), ...input };
      if (existing) {
        db.profiles = db.profiles.map((p) => (p.userId === userId ? next : p));
      } else {
        db.profiles.push(next);
      }
      return next;
    });
  }

  async setBaselineDate(userId: string, date: string | null): Promise<void> {
    await mutate((db) => {
      const existing = db.profiles.find((p) => p.userId === userId);
      if (existing) existing.baselineDate = date;
      else db.profiles.push({ ...defaultProfile(userId), baselineDate: date });
    });
  }

  async listSessions(userId: string): Promise<TrainingSession[]> {
    const db = await read();
    return db.sessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async createSession(
    userId: string,
    input: SessionInput,
    isDemo = false,
  ): Promise<TrainingSession> {
    return mutate((db) => {
      const session: TrainingSession = {
        id: randomUUID(),
        userId,
        date: input.date,
        sessionType: input.sessionType,
        durationMinutes: input.durationMinutes,
        position: input.position ?? null,
        rpe: input.rpe ?? null,
        notes: input.notes ?? null,
        isDemo,
        createdAt: new Date().toISOString(),
      };
      db.sessions.push(session);
      return session;
    });
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.sessions = db.sessions.filter((s) => !(s.id === id && s.userId === userId));
    });
  }

  async listResults(userId: string): Promise<TestResult[]> {
    const db = await read();
    return db.results
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }

  async createResult(
    userId: string,
    input: TestResultInput,
    isDemo = false,
  ): Promise<TestResult> {
    return mutate((db) => {
      const hasBaseline = db.results.some(
        (r) =>
          r.userId === userId &&
          r.protocolSlug === input.protocolSlug &&
          (r.variant ?? null) === (input.variant ?? null) &&
          r.isBaseline,
      );
      const result: TestResult = {
        id: randomUUID(),
        userId,
        protocolSlug: input.protocolSlug,
        protocolVersion: input.protocolVersion,
        performedAt: input.performedAt,
        value: input.value,
        attempts: input.attempts,
        detail: input.detail,
        variant: input.variant ?? null,
        measurementMethod: input.measurementMethod,
        reliabilityLevel: input.reliabilityLevel,
        conditions: input.conditions ?? null,
        notes: input.notes ?? null,
        // The first result recorded for a metric is its ZERO BASELINE.
        isBaseline: input.isBaseline ?? !hasBaseline,
        isDemo,
        createdAt: new Date().toISOString(),
      };
      db.results.push(result);

      const profile = db.profiles.find((p) => p.userId === userId);
      if (profile && !profile.baselineDate) profile.baselineDate = input.performedAt;
      return result;
    });
  }

  async deleteResult(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.results = db.results.filter((r) => !(r.id === id && r.userId === userId));
    });
  }

  async listCheckpoints(userId: string): Promise<Checkpoint[]> {
    const db = await read();
    return db.checkpoints
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async createCheckpoint(userId: string, input: CheckpointInput): Promise<Checkpoint> {
    return mutate((db) => {
      const checkpoint: Checkpoint = {
        ...input,
        userId,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      db.checkpoints.push(checkpoint);
      return checkpoint;
    });
  }

  async deleteCheckpoint(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.checkpoints = db.checkpoints.filter(
        (c) => !(c.id === id && c.userId === userId),
      );
    });
  }

  async clearDemoData(userId: string) {
    return mutate((db) => {
      const isTarget = (row: { userId: string; isDemo: boolean }) =>
        row.userId === userId && row.isDemo;
      const counts = {
        sessions: db.sessions.filter(isTarget).length,
        results: db.results.filter(isTarget).length,
        checkpoints: db.checkpoints.filter(isTarget).length,
      };
      db.sessions = db.sessions.filter((s) => !isTarget(s));
      db.results = db.results.filter((r) => !isTarget(r));
      db.checkpoints = db.checkpoints.filter((c) => !isTarget(c));

      const profile = db.profiles.find((p) => p.userId === userId);
      if (profile && db.results.filter((r) => r.userId === userId).length === 0) {
        profile.baselineDate = null;
      }
      return counts;
    });
  }
}
