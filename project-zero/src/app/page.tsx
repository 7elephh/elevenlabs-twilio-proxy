import Link from "next/link";

import { ChangeBadge, DemoBadge, ReliabilityBadge, TrendBadge, WeightBadge } from "@/components/badges";
import { Card, EmptyState, Notice, SectionTitle, StatTile } from "@/components/ui";
import { loadPlayerData, trainingTotals } from "@/lib/data/queries";
import { nextCheckpointDue } from "@/lib/domain/checkpoints";
import { POSITION_LABELS, roleProfile } from "@/lib/domain/positions";
import { currentPriorities, suggestedTests } from "@/lib/domain/priorities";
import { daysSince, formatDate, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, sessions, results, checkpoints, series } = await loadPlayerData();
  const totals = trainingTotals(sessions);
  const next = nextCheckpointDue(profile.baselineDate, checkpoints);
  const priorities = currentPriorities({
    position: profile.primaryPosition,
    role: profile.preferredRole,
    series,
  });
  const suggestions = suggestedTests(
    { position: profile.primaryPosition, role: profile.preferredRole, series },
    3,
  );
  const hasDemo =
    sessions.some((s) => s.isDemo) || results.some((r) => r.isDemo);

  const recentMovers = [...series]
    .filter((s) => s.changeVsBaseline !== null)
    .sort(
      (a, b) =>
        Math.abs(b.changeVsBaseline!.percent) - Math.abs(a.changeVsBaseline!.percent),
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-chalk-100">
            {profile.displayName}
          </h1>
          {hasDemo ? <DemoBadge /> : null}
        </div>
        <p className="mt-1 text-sm text-chalk-600">
          {POSITION_LABELS[profile.primaryPosition]} ({profile.primaryPosition}) ·{" "}
          {roleProfile(profile.preferredRole).label}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Days since baseline"
          value={profile.baselineDate ? daysSince(profile.baselineDate) : "—"}
          sub={profile.baselineDate ? formatDate(profile.baselineDate) : "No baseline yet"}
        />
        <StatTile label="Sessions" value={totals.sessions} sub={`${totals.last7Days} in the last 7 days`} />
        <StatTile label="Hours" value={totals.hours} sub="Logged training time" />
        <StatTile label="Matches" value={totals.matches} />
        <StatTile
          label="Next checkpoint"
          value={next ? (next.overdue ? "Due" : `${next.daysRemaining} d`) : "—"}
          sub={next ? `${next.kind === "SIMPLE" ? "30-day" : "90-day"} · ${formatDate(next.dueDate)}` : "Run your first test"}
        />
        <StatTile label="Metrics tracked" value={series.length} sub={`${results.length} results`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/sessions/new" className="pz-button">
          + Log a session
        </Link>
        <Link href="/tests" className="pz-button-ghost w-full">
          Start a test
        </Link>
      </div>

      <section>
        <SectionTitle
          title="Current priorities"
          hint="Position and role weights, combined with staleness and trend. No rating, no model."
        />
        {priorities.length === 0 ? (
          <EmptyState
            title="Nothing to prioritise yet"
            body="Set your position in the profile, then run your first tests to create the ZERO BASELINE."
            ctaHref="/profile"
            ctaLabel="Open profile"
          />
        ) : (
          <ul className="space-y-3">
            {priorities.map((item) => (
              <li key={item.metricKey}>
                <Link href={`/tests/${item.protocol.slug}`} className="block">
                  <Card className="transition hover:border-ink-600">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-chalk-100">{item.protocol.name}</p>
                        <p className="mt-1 text-xs text-chalk-600">{item.reason}</p>
                      </div>
                      <WeightBadge weight={item.weight} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <TrendBadge trend={item.trend} />
                      <span className="text-[10px] uppercase tracking-[0.1em] text-chalk-600">
                        {item.daysSinceLastTest === null
                          ? "Never tested"
                          : `Last test ${item.daysSinceLastTest} d ago`}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentMovers.length > 0 ? (
        <section>
          <SectionTitle title="Versus baseline" hint="Latest value compared with the ZERO BASELINE." />
          <ul className="space-y-2">
            {recentMovers.map((s) => (
              <li key={s.metricKey}>
                <Link href={`/progress?metric=${encodeURIComponent(s.metricKey)}`}>
                  <Card className="flex items-center justify-between gap-3 py-3 transition hover:border-ink-600">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-chalk-100">{s.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-chalk-600">
                        {s.baseline ? formatValue(s.baseline.value, s.unit) : "—"} →{" "}
                        {formatValue(s.latest.value, s.unit)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ChangeBadge
                        percent={s.changeVsBaseline?.percent ?? null}
                        isImprovement={s.changeVsBaseline?.isImprovement}
                      />
                      <ReliabilityBadge level={s.reliability} mixed={s.mixedReliability} />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {suggestions.length > 0 ? (
        <section>
          <SectionTitle title="Suggested next tests" hint="Never measured, or older than 30 days." />
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <Link
                key={item.metricKey}
                href={`/tests/${item.protocol.slug}`}
                className="rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-chalk-300"
              >
                {item.protocol.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {hasDemo ? (
        <Notice tone="warn">
          This account contains demonstration data. Remove it from the profile page before
          reading any of these numbers as your own.
        </Notice>
      ) : null}
    </div>
  );
}
