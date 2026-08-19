import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteResultAction } from "@/actions/test-actions";
import {
  ChangeBadge,
  DemoBadge,
  MeasurementTypeBadge,
  ReliabilityBadge,
  TrendBadge,
  WeightBadge,
} from "@/components/badges";
import { TestRunner, type RunnerHistoryPoint } from "@/components/test-runner";
import { Card, Notice, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { loadPlayerData } from "@/lib/data/queries";
import { effectiveWeight } from "@/lib/domain/positions";
import { getProtocol } from "@/lib/domain/protocols";
import { metricKey } from "@/lib/domain/progress";
import {
  MEASUREMENT_METHOD_LABELS,
  formatDate,
  formatPace,
  formatValue,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const protocol = getProtocol(slug);
  if (!protocol) notFound();

  const { profile, results, series } = await loadPlayerData();
  const own = results
    .filter((r) => r.protocolSlug === slug)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  const history: RunnerHistoryPoint[] = own
    .map((r) => ({
      date: r.performedAt,
      value: r.value,
      reliability: r.reliabilityLevel,
      protocolVersion: r.protocolVersion,
      resultId: r.id,
      variant: r.variant,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const protocolSeries = series.filter((s) => s.protocolSlug === slug);
  const weight = effectiveWeight(profile.primaryPosition, profile.preferredRole, slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title={protocol.name}
        subtitle={protocol.description}
        action={<WeightBadge weight={weight} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <MeasurementTypeBadge type={protocol.measurementType} />
        <ReliabilityBadge level={protocol.defaultReliability} />
        <span className="rounded-md bg-ink-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-chalk-300">
          {protocol.improvementDirection === "LOWER_IS_BETTER"
            ? "Lower is better"
            : "Higher is better"}
        </span>
        <span className="rounded-md bg-ink-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-chalk-300">
          Protocol v{protocol.protocolVersion}
        </span>
      </div>

      <TestRunner protocol={protocol} history={history} />

      {protocolSeries.map((s) => (
        <section key={s.metricKey}>
          <SectionTitle
            title={s.variant ? `Progression — ${s.label}` : "Progression"}
            action={
              <Link
                href={`/progress?metric=${encodeURIComponent(s.metricKey)}`}
                className="text-xs text-chalk-500 underline"
              >
                Open chart
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Baseline"
              value={s.baseline ? formatValue(s.baseline.value, s.unit) : "—"}
              sub={s.baseline ? formatDate(s.baseline.date) : undefined}
            />
            <StatTile label="Latest" value={formatValue(s.latest.value, s.unit)} sub={formatDate(s.latest.date)} />
            <StatTile label="Best" value={formatValue(s.best.value, s.unit)} sub={formatDate(s.best.date)} />
            <StatTile label="Measurements" value={s.observations} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrendBadge trend={s.trend.trend} />
            <ChangeBadge
              percent={s.changeVsBaseline?.percent ?? null}
              isImprovement={s.changeVsBaseline?.isImprovement}
              suffix="vs baseline"
            />
            <ReliabilityBadge level={s.reliability} mixed={s.mixedReliability} />
          </div>
          {s.versionMismatch ? (
            <div className="mt-3">
              <Notice tone="warn">
                Baseline and latest result come from different protocol versions. Compare
                them with care.
              </Notice>
            </div>
          ) : null}
        </section>
      ))}

      <section>
        <SectionTitle title="Protocol" hint={`${protocol.attempts} attempt(s) · ${protocol.restSeconds}s rest`} />
        <Card>
          <ol className="space-y-2 text-sm text-chalk-300">
            {protocol.instructions.map((line, index) => (
              <li key={line} className="flex gap-3">
                <span className="font-mono text-xs text-chalk-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-chalk-600">
            Equipment: {protocol.equipment.join(", ")}
          </p>
          {protocol.notes ? (
            <p className="mt-2 text-xs text-chalk-600">{protocol.notes}</p>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle title="History" hint={`${own.length} recorded result(s)`} />
        {own.length === 0 ? (
          <Card>
            <p className="text-sm text-chalk-600">
              No result yet. The first one you record becomes the ZERO BASELINE for this
              metric.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {own.map((result) => (
              <li key={result.id}>
                <Card className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-lg font-semibold text-chalk-100">
                          {formatValue(result.value, protocol.unit)}
                        </p>
                        {result.isBaseline ? (
                          <span className="rounded-md bg-signal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-signal">
                            Baseline
                          </span>
                        ) : null}
                        {result.isDemo ? <DemoBadge /> : null}
                      </div>
                      <p className="mt-1 text-xs text-chalk-600">
                        {formatDate(result.performedAt)} ·{" "}
                        {MEASUREMENT_METHOD_LABELS[result.measurementMethod]} · v
                        {result.protocolVersion}
                        {result.variant
                          ? ` · ${metricKey(result.protocolSlug, result.variant).split("::")[1]} m`
                          : ""}
                      </p>
                      <p className="mt-1 font-mono text-xs text-chalk-600">
                        {renderDetail(result.detail)}
                      </p>
                      {result.conditions ? (
                        <p className="mt-1 text-xs text-chalk-600">
                          Conditions: {result.conditions}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <ReliabilityBadge level={result.reliabilityLevel} />
                      <form action={deleteResultAction}>
                        <input type="hidden" name="id" value={result.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <button
                          type="submit"
                          className="text-xs text-chalk-600 transition hover:text-alert"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function renderDetail(detail: Record<string, number | string>): string {
  return Object.entries(detail)
    .map(([key, value]) => {
      if (key === "pace_s_per_km") return `pace ${formatPace(Number(value))}`;
      return `${key.replace(/_/g, " ")}: ${value}`;
    })
    .join(" · ");
}
