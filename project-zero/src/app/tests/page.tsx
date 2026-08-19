import Link from "next/link";

import { MeasurementTypeBadge, ReliabilityBadge, TrendBadge, WeightBadge } from "@/components/badges";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { loadPlayerData } from "@/lib/data/queries";
import { effectiveWeight, roleProfile } from "@/lib/domain/positions";
import { activeProtocols } from "@/lib/domain/protocols";
import { WEIGHT_SCORE } from "@/lib/domain/positions";
import { formatValue } from "@/lib/format";
import { TEST_CATEGORIES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  PHYSICAL: "Physical",
  POSITIONAL: "Positional",
};

export default async function TestsPage() {
  const { profile, series } = await loadPlayerData();
  const protocols = activeProtocols();

  const latestBySlug = new Map(
    series.map((s) => [s.protocolSlug, s] as const),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        subtitle={`Ordered by relevance for ${profile.primaryPosition} · ${roleProfile(profile.preferredRole).label}`}
      />

      <Notice>
        Relevance weights only sort this catalogue and the dashboard priorities. V0.1
        computes no overall rating.
      </Notice>

      {TEST_CATEGORIES.map((category) => {
        const list = protocols
          .filter((p) => p.category === category)
          .sort(
            (a, b) =>
              WEIGHT_SCORE[effectiveWeight(profile.primaryPosition, profile.preferredRole, b.slug)] -
              WEIGHT_SCORE[effectiveWeight(profile.primaryPosition, profile.preferredRole, a.slug)],
          );
        if (list.length === 0) return null;

        return (
          <section key={category}>
            <SectionTitle title={CATEGORY_LABELS[category]} />
            <ul className="space-y-2">
              {list.map((protocol) => {
                const weight = effectiveWeight(
                  profile.primaryPosition,
                  profile.preferredRole,
                  protocol.slug,
                );
                const s = latestBySlug.get(protocol.slug);
                return (
                  <li key={protocol.slug}>
                    <Link href={`/tests/${protocol.slug}`}>
                      <Card className="transition hover:border-ink-600">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-chalk-100">{protocol.name}</p>
                            <p className="mt-1 text-xs leading-relaxed text-chalk-600">
                              {protocol.description}
                            </p>
                          </div>
                          <WeightBadge weight={weight} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <MeasurementTypeBadge type={protocol.measurementType} />
                          <ReliabilityBadge level={protocol.defaultReliability} />
                          {s ? <TrendBadge trend={s.trend.trend} /> : null}
                          {s ? (
                            <span className="font-mono text-xs text-chalk-500">
                              Last: {formatValue(s.latest.value, s.unit)}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.1em] text-chalk-600">
                              Never measured
                            </span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
