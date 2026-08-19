import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { buildMetricSeries } from "@/lib/domain/progress";
import type { MetricSeries } from "@/lib/domain/progress";
import type {
  Checkpoint,
  PlayerProfile,
  TestResult,
  TrainingSession,
} from "@/lib/domain/types";
import { getCurrentUser, getProfileOrDefault, getStore } from ".";
import type { CurrentUser, DataStore } from "./store";

export type PlayerData = {
  user: CurrentUser;
  store: DataStore;
  profile: PlayerProfile;
  sessions: TrainingSession[];
  results: TestResult[];
  checkpoints: Checkpoint[];
  series: MetricSeries[];
};

/** Every page loads through here, so auth and shaping stay in one place. */
export async function loadPlayerData(): Promise<PlayerData> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const store = await getStore();
  const [profile, sessions, results, checkpoints] = await Promise.all([
    getProfileOrDefault(store, user.id),
    store.listSessions(user.id),
    store.listResults(user.id),
    store.listCheckpoints(user.id),
  ]);

  return {
    user,
    store,
    profile,
    sessions,
    results,
    checkpoints,
    series: buildMetricSeries(results),
  };
}

export type TrainingTotals = {
  sessions: number;
  hours: number;
  matches: number;
  last7Days: number;
};

export function trainingTotals(sessions: TrainingSession[]): TrainingTotals {
  const cutoff = Date.now() - 7 * 86_400_000;
  return {
    sessions: sessions.length,
    hours:
      Math.round(
        (sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60) * 10,
      ) / 10,
    matches: sessions.filter((s) => s.sessionType === "MATCH").length,
    last7Days: sessions.filter(
      (s) => new Date(`${s.date}T00:00:00Z`).getTime() >= cutoff,
    ).length,
  };
}

export const authEnabled = isSupabaseConfigured;
