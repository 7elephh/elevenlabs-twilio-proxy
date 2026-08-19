import { deleteCheckpointAction } from "@/actions/checkpoint-actions";
import { ChangeBadge, DemoBadge, ReliabilityBadge, TrendBadge } from "@/components/badges";
import { CheckpointForm } from "@/components/checkpoint-form";
import { Card, EmptyState, Notice, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { loadPlayerData } from "@/lib/data/queries";
import { nextCheckpointDue } from "@/lib/domain/checkpoints";
import { formatDate, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CheckpointsPage() {
  const { profile, checkpoints } = await loadPlayerData();
  const next = nextCheckpointDue(profile.baselineDate, checkpoints);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkpoints"
        subtitle="Periodic snapshots: 30 days for a simple check, 90 days for a full review."
      />

      {next ? (
        <Notice tone={next.overdue ? "warn" : "info"}>
          Next {next.kind === "SIMPLE" ? "30-day" : "90-day"} checkpoint:{" "}
          {formatDate(next.dueDate)}{" "}
          {next.overdue
            ? `— overdue by ${Math.abs(next.daysRemaining)} days`
            : `— in ${next.daysRemaining} days`}
        </Notice>
      ) : (
        <Notice>
          Checkpoints start counting from the ZERO BASELINE. Run your first test to set
          it.
        </Notice>
      )}

      <section>
        <SectionTitle title="New checkpoint" hint="Sessions, hours, matches and metric deltas are computed for you." />
        <Card>
          <CheckpointForm />
        </Card>
      </section>

      <section>
        <SectionTitle title="History" />
        {checkpoints.length === 0 ? (
          <EmptyState
            title="No checkpoint yet"
            body="Create one after a training block to freeze where you stand."
          />
        ) : (
          <ul className="space-y-4">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-chalk-100">
                          {formatDate(checkpoint.date)}
                        </p>
                        <span className="rounded-md bg-ink-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-chalk-300">
                          {checkpoint.kind === "SIMPLE" ? "30-day" : "90-day"}
                        </span>
                        {checkpoint.isDemo ? <DemoBadge /> : null}
                      </div>
                      {checkpoint.notes ? (
                        <p className="mt-1 text-sm text-chalk-500">{checkpoint.notes}</p>
                      ) : null}
                    </div>
                    <form action={deleteCheckpointAction}>
                      <input type="hidden" name="id" value={checkpoint.id} />
                      <button
                        type="submit"
                        className="text-xs text-chalk-600 transition hover:text-alert"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <StatTile label="Sessions" value={checkpoint.sessionsSincePrevious} />
                    <StatTile label="Hours" value={checkpoint.trainingHoursSincePrevious} />
                    <StatTile label="Matches" value={checkpoint.matchesSincePrevious} />
                  </div>

                  {checkpoint.metrics.length === 0 ? (
                    <p className="mt-4 text-sm text-chalk-600">
                      No measurement recorded before this date.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {checkpoint.metrics.map((metric) => (
                        <li
                          key={metric.metricKey}
                          className="rounded-xl border border-ink-700 bg-ink-900 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-chalk-100">
                                {metric.label}
                              </p>
                              <p className="mt-1 font-mono text-xs text-chalk-600">
                                baseline{" "}
                                {metric.baselineValue !== null
                                  ? formatValue(metric.baselineValue, metric.unit)
                                  : "—"}{" "}
                                · now {formatValue(metric.latestValue, metric.unit)} · best{" "}
                                {formatValue(metric.bestValue, metric.unit)}
                              </p>
                            </div>
                            <ReliabilityBadge level={metric.reliability} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <TrendBadge trend={metric.trend} />
                            <ChangeBadge
                              percent={metric.changeVsBaselinePct}
                              isImprovement={
                                metric.changeVsBaselinePct === null
                                  ? undefined
                                  : metric.improvementDirection === "HIGHER_IS_BETTER"
                                    ? metric.changeVsBaselinePct > 0
                                    : metric.changeVsBaselinePct < 0
                              }
                              suffix="vs baseline"
                            />
                            <ChangeBadge
                              percent={metric.changeVsPreviousPct}
                              isImprovement={
                                metric.changeVsPreviousPct === null
                                  ? undefined
                                  : metric.improvementDirection === "HIGHER_IS_BETTER"
                                    ? metric.changeVsPreviousPct > 0
                                    : metric.changeVsPreviousPct < 0
                              }
                              suffix="vs previous checkpoint"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
