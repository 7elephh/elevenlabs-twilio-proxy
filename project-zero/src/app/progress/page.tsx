import { EmptyState, PageHeader } from "@/components/ui";
import { ProgressExplorer } from "@/components/progress-explorer";
import { loadPlayerData } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const { metric } = await searchParams;
  const { series } = await loadPlayerData();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress"
        subtitle="Baseline, latest, best, and a trend that stays quiet without enough data."
      />
      {series.length === 0 ? (
        <EmptyState
          title="Nothing measured yet"
          body="Run a test to create your ZERO BASELINE. Progression is computed from there."
          ctaHref="/tests"
          ctaLabel="Open the test catalogue"
        />
      ) : (
        <ProgressExplorer series={series} initialMetric={metric} />
      )}
    </div>
  );
}
