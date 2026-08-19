"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChangeBadge, ReliabilityBadge, TrendBadge } from "@/components/badges";
import { Card, Notice, StatTile } from "@/components/ui";
import {
  RANGE_LABELS,
  computeChange,
  computeTrend,
  filterPointsByRange,
  type MetricSeries,
  type RangeKey,
} from "@/lib/domain/progress";
import { formatShortDate, formatValue } from "@/lib/format";

const RANGES: RangeKey[] = ["30d", "90d", "6m", "1y", "all"];

export type SerializableSeries = MetricSeries;

/**
 * Progress view: one metric at a time, always with its baseline, its
 * reliability and a trend that refuses to guess below three observations.
 */
export function ProgressExplorer({
  series,
  initialMetric,
}: {
  series: SerializableSeries[];
  initialMetric?: string;
}) {
  const [metric, setMetric] = useState(
    initialMetric && series.some((s) => s.metricKey === initialMetric)
      ? initialMetric
      : (series[0]?.metricKey ?? ""),
  );
  const [range, setRange] = useState<RangeKey>("all");

  const selected = series.find((s) => s.metricKey === metric) ?? series[0];

  const visiblePoints = useMemo(
    () => (selected ? filterPointsByRange(selected.points, range) : []),
    [selected, range],
  );

  const rangeTrend = useMemo(
    () =>
      selected ? computeTrend(visiblePoints, selected.improvementDirection) : null,
    [selected, visiblePoints],
  );

  const rangeChange = useMemo(() => {
    if (!selected || visiblePoints.length < 2) return null;
    return computeChange(
      visiblePoints[0].value,
      visiblePoints[visiblePoints.length - 1].value,
      selected.improvementDirection,
    );
  }, [selected, visiblePoints]);

  if (!selected) return null;

  const chartData = visiblePoints.map((point) => ({
    date: formatShortDate(point.date),
    value: point.value,
  }));

  return (
    <div className="space-y-5">
      <div>
        <label className="pz-label mb-2" htmlFor="metric">
          Metric
        </label>
        <select
          id="metric"
          className="pz-input"
          value={selected.metricKey}
          onChange={(event) => setMetric(event.target.value)}
        >
          {series.map((s) => (
            <option key={s.metricKey} value={s.metricKey}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Baseline"
          value={selected.baseline ? formatValue(selected.baseline.value, selected.unit) : "—"}
        />
        <StatTile label="Latest" value={formatValue(selected.latest.value, selected.unit)} />
        <StatTile label="Best" value={formatValue(selected.best.value, selected.unit)} />
        <StatTile label="Measurements" value={selected.observations} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TrendBadge trend={selected.trend.trend} />
        <ChangeBadge
          percent={selected.changeVsBaseline?.percent ?? null}
          isImprovement={selected.changeVsBaseline?.isImprovement}
          suffix="vs baseline"
        />
        <ChangeBadge
          percent={selected.changeVsPrevious?.percent ?? null}
          isImprovement={selected.changeVsPrevious?.isImprovement}
          suffix="vs previous"
        />
        <ReliabilityBadge level={selected.reliability} mixed={selected.mixedReliability} />
      </div>

      {selected.versionMismatch ? (
        <Notice tone="warn">
          These results span several protocol versions. The comparison is indicative
          only.
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {RANGES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`min-h-[40px] rounded-lg border px-3 text-xs font-medium transition ${
              range === key
                ? "border-signal bg-signal/15 text-signal"
                : "border-ink-700 bg-ink-900 text-chalk-500"
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      <Card className="px-1 py-4">
        {chartData.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-chalk-600">
            No measurement in this window.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="#232830" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6b7583"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#232830" }}
                />
                <YAxis
                  stroke="#6b7583"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111418",
                    border: "1px solid #232830",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#f2f5f7",
                  }}
                  formatter={(value) => [
                    formatValue(Number(value), selected.unit),
                    selected.label,
                  ]}
                />
                {selected.baseline ? (
                  <ReferenceLine
                    y={selected.baseline.value}
                    stroke="#6b7583"
                    strokeDasharray="4 4"
                    label={{ value: "baseline", fill: "#6b7583", fontSize: 10, position: "insideBottomLeft" }}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3ddc84"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#3ddc84" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.14em] text-chalk-600">
          Selected window — {RANGE_LABELS[range]}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {rangeTrend ? <TrendBadge trend={rangeTrend.trend} /> : null}
          <ChangeBadge
            percent={rangeChange?.percent ?? null}
            isImprovement={rangeChange?.isImprovement}
            suffix="over the window"
          />
          <span className="text-[10px] uppercase tracking-[0.1em] text-chalk-600">
            {visiblePoints.length} measurement{visiblePoints.length > 1 ? "s" : ""}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-chalk-600">
          Trends come from a least-squares fit over the last measurements
          (min. 3). A modelled change under 3 % is reported as stable rather than as
          progress.
        </p>
      </Card>
    </div>
  );
}
