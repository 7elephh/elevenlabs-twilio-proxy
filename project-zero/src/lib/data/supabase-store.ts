import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Checkpoint,
  CheckpointMetricSummary,
  PlayerProfile,
  Position,
  Role,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function toProfile(row: Row): PlayerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    primaryPosition: row.primary_position as Position,
    secondaryPositions: (row.secondary_positions ?? []) as Position[],
    preferredRole: row.preferred_role as Role,
    baselineDate: row.baseline_date ?? null,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

function toSession(row: Row): TrainingSession {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    sessionType: row.session_type,
    durationMinutes: row.duration_minutes,
    position: row.position ?? null,
    rpe: row.rpe ?? null,
    notes: row.notes ?? null,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

function toResult(row: Row): TestResult {
  return {
    id: row.id,
    userId: row.user_id,
    protocolSlug: row.protocol_slug,
    protocolVersion: row.protocol_version,
    performedAt: row.performed_at,
    value: Number(row.value),
    attempts: (row.attempts ?? []).map(Number),
    detail: row.detail ?? {},
    variant: row.variant ?? null,
    measurementMethod: row.measurement_method,
    reliabilityLevel: row.reliability_level,
    conditions: row.conditions ?? null,
    notes: row.notes ?? null,
    isBaseline: row.is_baseline ?? false,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

function toCheckpoint(row: Row): Checkpoint {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    kind: row.kind,
    sessionsSincePrevious: row.sessions_since_previous,
    trainingHoursSincePrevious: Number(row.training_hours_since_previous),
    matchesSincePrevious: row.matches_since_previous,
    metrics: (row.metrics ?? []) as CheckpointMetricSummary[],
    notes: row.notes ?? null,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Supabase returned no data");
  return data;
}

/** Supabase-backed implementation. Row access is additionally gated by RLS. */
export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  async getProfile(userId: string): Promise<PlayerProfile | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProfile(data) : null;
  }

  async saveProfile(userId: string, input: ProfileInput): Promise<PlayerProfile> {
    const { data, error } = await this.client
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          display_name: input.displayName,
          primary_position: input.primaryPosition,
          secondary_positions: input.secondaryPositions,
          preferred_role: input.preferredRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    return toProfile(unwrap(data, error));
  }

  async setBaselineDate(userId: string, date: string | null): Promise<void> {
    const { error } = await this.client
      .from("profiles")
      .update({ baseline_date: date })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async listSessions(userId: string): Promise<TrainingSession[]> {
    const { data, error } = await this.client
      .from("training_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    return unwrap(data, error).map(toSession);
  }

  async createSession(
    userId: string,
    input: SessionInput,
    isDemo = false,
  ): Promise<TrainingSession> {
    const { data, error } = await this.client
      .from("training_sessions")
      .insert({
        user_id: userId,
        date: input.date,
        session_type: input.sessionType,
        duration_minutes: input.durationMinutes,
        position: input.position ?? null,
        rpe: input.rpe ?? null,
        notes: input.notes ?? null,
        is_demo: isDemo,
      })
      .select()
      .single();
    return toSession(unwrap(data, error));
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("training_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async listResults(userId: string): Promise<TestResult[]> {
    const { data, error } = await this.client
      .from("test_results")
      .select("*")
      .eq("user_id", userId)
      .order("performed_at", { ascending: true });
    return unwrap(data, error).map(toResult);
  }

  async createResult(
    userId: string,
    input: TestResultInput,
    isDemo = false,
  ): Promise<TestResult> {
    let isBaseline = input.isBaseline;
    if (isBaseline === undefined) {
      // The first result recorded for a metric becomes its ZERO BASELINE.
      let query = this.client
        .from("test_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("protocol_slug", input.protocolSlug)
        .eq("is_baseline", true);
      query = input.variant
        ? query.eq("variant", input.variant)
        : query.is("variant", null);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      isBaseline = (count ?? 0) === 0;
    }

    const { data, error } = await this.client
      .from("test_results")
      .insert({
        user_id: userId,
        protocol_slug: input.protocolSlug,
        protocol_version: input.protocolVersion,
        performed_at: input.performedAt,
        value: input.value,
        attempts: input.attempts,
        detail: input.detail,
        variant: input.variant ?? null,
        measurement_method: input.measurementMethod,
        reliability_level: input.reliabilityLevel,
        conditions: input.conditions ?? null,
        notes: input.notes ?? null,
        is_baseline: isBaseline,
        is_demo: isDemo,
      })
      .select()
      .single();

    const result = toResult(unwrap(data, error));

    const profile = await this.getProfile(userId);
    if (profile && !profile.baselineDate) {
      await this.setBaselineDate(userId, input.performedAt);
    }
    return result;
  }

  async deleteResult(userId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("test_results")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async listCheckpoints(userId: string): Promise<Checkpoint[]> {
    const { data, error } = await this.client
      .from("checkpoints")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    return unwrap(data, error).map(toCheckpoint);
  }

  async createCheckpoint(userId: string, input: CheckpointInput): Promise<Checkpoint> {
    const { data, error } = await this.client
      .from("checkpoints")
      .insert({
        user_id: userId,
        date: input.date,
        kind: input.kind,
        sessions_since_previous: input.sessionsSincePrevious,
        training_hours_since_previous: input.trainingHoursSincePrevious,
        matches_since_previous: input.matchesSincePrevious,
        metrics: input.metrics,
        notes: input.notes ?? null,
        is_demo: input.isDemo ?? false,
      })
      .select()
      .single();
    return toCheckpoint(unwrap(data, error));
  }

  async deleteCheckpoint(userId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("checkpoints")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  async clearDemoData(userId: string) {
    const counts = { sessions: 0, results: 0, checkpoints: 0 };
    for (const [key, table] of [
      ["sessions", "training_sessions"],
      ["results", "test_results"],
      ["checkpoints", "checkpoints"],
    ] as const) {
      const { data, error } = await this.client
        .from(table)
        .delete()
        .eq("user_id", userId)
        .eq("is_demo", true)
        .select("id");
      if (error) throw new Error(error.message);
      counts[key] = data?.length ?? 0;
    }

    const { count } = await this.client
      .from("test_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) === 0) await this.setBaselineDate(userId, null);

    return counts;
  }
}
