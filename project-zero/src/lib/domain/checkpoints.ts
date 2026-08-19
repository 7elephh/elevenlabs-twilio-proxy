import { PROTOCOLS_BY_SLUG } from "./protocols";
import { buildMetricSeries, computeChange, computeTrend } from "./progress";
import type {
  Checkpoint,
  CheckpointKind,
  CheckpointMetricSummary,
  TestResult,
  TrainingSession,
} from "./types";
import { CHECKPOINT_INTERVAL_DAYS } from "./types";

/**
 * Checkpoints are computed snapshots, not hand-written journals: every number
 * below is derived from sessions and test results already recorded.
 */

export type CheckpointDraft = Omit<Checkpoint, "id" | "createdAt">;

export type BuildCheckpointInput = {
  userId: string;
  date: string;
  kind: CheckpointKind;
  sessions: TrainingSession[];
  results: TestResult[];
  previousCheckpointDate: string | null;
  notes?: string | null;
  isDemo?: boolean;
};

function inWindow(date: string, from: string | null, to: string): boolean {
  const t = new Date(date).getTime();
  if (t > new Date(to).getTime()) return false;
  if (from && t <= new Date(from).getTime()) return false;
  return true;
}

export function buildCheckpoint({
  userId,
  date,
  kind,
  sessions,
  results,
  previousCheckpointDate,
  notes = null,
  isDemo = false,
}: BuildCheckpointInput): CheckpointDraft {
  const windowSessions = sessions.filter((s) =>
    inWindow(s.date, previousCheckpointDate, date),
  );
  const upToDate = results.filter(
    (r) => new Date(r.performedAt).getTime() <= new Date(date).getTime(),
  );

  const metrics: CheckpointMetricSummary[] = buildMetricSeries(upToDate).map(
    (series) => {
      const protocol = PROTOCOLS_BY_SLUG[series.protocolSlug];
      const pointsBeforeWindow = series.points.filter(
        (p) =>
          previousCheckpointDate !== null &&
          new Date(p.date).getTime() <= new Date(previousCheckpointDate).getTime(),
      );
      const previous =
        pointsBeforeWindow.length > 0
          ? pointsBeforeWindow[pointsBeforeWindow.length - 1]
          : null;

      const changeVsPrevious = previous
        ? computeChange(previous.value, series.latest.value, protocol.improvementDirection)
        : null;

      return {
        metricKey: series.metricKey,
        protocolSlug: series.protocolSlug,
        label: series.label,
        unit: series.unit,
        improvementDirection: protocol.improvementDirection,
        reliability: series.reliability,
        baselineValue: series.baseline?.value ?? null,
        previousValue: previous?.value ?? null,
        latestValue: series.latest.value,
        bestValue: series.best.value,
        changeVsBaselinePct: series.changeVsBaseline?.percent ?? null,
        changeVsPreviousPct: changeVsPrevious?.percent ?? null,
        trend: computeTrend(series.points, protocol.improvementDirection).trend,
        observations: series.observations,
      };
    },
  );

  return {
    userId,
    date,
    kind,
    sessionsSincePrevious: windowSessions.length,
    trainingHoursSincePrevious:
      Math.round(
        (windowSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60) * 10,
      ) / 10,
    matchesSincePrevious: windowSessions.filter((s) => s.sessionType === "MATCH")
      .length,
    metrics,
    notes,
    isDemo,
  };
}

export type NextCheckpoint = {
  kind: CheckpointKind;
  dueDate: string;
  daysRemaining: number;
  overdue: boolean;
};

/**
 * Next checkpoint due, counted from the last checkpoint of that kind, or from
 * the baseline date when none exists yet.
 */
export function nextCheckpointDue(
  baselineDate: string | null,
  checkpoints: Checkpoint[],
  now: Date = new Date(),
): NextCheckpoint | null {
  if (!baselineDate) return null;

  const candidates: NextCheckpoint[] = (["SIMPLE", "FULL"] as CheckpointKind[]).map(
    (kind) => {
      const last = checkpoints
        .filter((c) => c.kind === kind)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const from = last ? last.date : baselineDate;
      const due = new Date(
        new Date(from).getTime() + CHECKPOINT_INTERVAL_DAYS[kind] * 86_400_000,
      );
      const daysRemaining = Math.ceil(
        (due.getTime() - now.getTime()) / 86_400_000,
      );
      return {
        kind,
        dueDate: due.toISOString().slice(0, 10),
        daysRemaining,
        overdue: daysRemaining < 0,
      };
    },
  );

  return candidates.sort((a, b) => a.daysRemaining - b.daysRemaining)[0];
}
