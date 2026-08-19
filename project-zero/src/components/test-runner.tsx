"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { submitTestResultAction } from "@/actions/test-actions";
import { notifyQueueChanged } from "@/components/offline-sync";
import { enqueue, isNetworkError, isOffline } from "@/lib/offline/queue";
import { ReliabilityBadge, TrendBadge } from "@/components/badges";
import { Card, Notice } from "@/components/ui";
import {
  bestValue,
  computeChange,
  computeTrend,
  type MetricPoint,
} from "@/lib/domain/progress";
import { scoreResult, validateRawInput } from "@/lib/domain/scoring";
import { MEASUREMENT_METHODS, RELIABILITY_LEVELS } from "@/lib/domain/types";
import type {
  MeasurementMethod,
  ReliabilityLevel,
  TestProtocol,
} from "@/lib/domain/types";
import { MEASUREMENT_METHOD_LABELS, formatPercent, formatValue, todayIso } from "@/lib/format";

export type RunnerHistoryPoint = MetricPoint & { variant: string | null };

type Summary = {
  value: number;
  baseline: number | null;
  best: number;
  trendLabel: string;
  trend: ReturnType<typeof computeTrend>["trend"];
  changeVsBaselinePct: number | null;
  isImprovement: boolean;
  reliability: ReliabilityLevel;
  observations: number;
  queuedOffline: boolean;
};

const STEP_LABELS = ["Protocol", "Attempts", "Result"] as const;

/**
 * START TEST flow: read the protocol, record each attempt, submit, and get the
 * comparison with the baseline and the best result immediately.
 */
export function TestRunner({
  protocol,
  history,
}: {
  protocol: TestProtocol;
  history: RunnerHistoryPoint[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const attemptCount =
    protocol.slug === "crossing-accuracy" ? 0 : protocol.attempts;

  const [attempts, setAttempts] = useState<string[]>(
    Array.from({ length: Math.max(attemptCount, 0) }, () => ""),
  );
  const [extras, setExtras] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of protocol.extraFields ?? []) {
      initial[field.key] =
        field.key === "penalty_seconds"
          ? "0.5"
          : field.type === "select"
            ? (field.options?.[0]?.value ?? "")
            : "0";
    }
    return initial;
  });
  const [performedAt, setPerformedAt] = useState(todayIso());
  const [method, setMethod] = useState<MeasurementMethod>(
    protocol.unit === "s" ? "PHONE_VIDEO" : "MANUAL_COUNT",
  );
  const [reliability, setReliability] = useState<ReliabilityLevel>(
    protocol.defaultReliability,
  );
  const [conditions, setConditions] = useState("");

  const rawInput = useMemo(
    () => ({
      attempts: attempts
        .map((a) => Number(a.replace(",", ".")))
        // Blank inputs read as 0; zero is only a real value where it can be scored.
        .filter(
          (a) =>
            Number.isFinite(a) && (a !== 0 || protocol.slug === "finishing-accuracy"),
        ),
      extras: Object.fromEntries(
        Object.entries(extras).map(([k, v]) => [k, Number(v.replace(",", ".")) || 0]),
      ) as Record<string, number>,
    }),
    [attempts, extras, protocol.slug],
  );

  const preview = useMemo(() => {
    if (validateRawInput(protocol, rawInput)) return null;
    return scoreResult(protocol, rawInput);
  }, [protocol, rawInput]);

  function submit() {
    const problem = validateRawInput(protocol, rawInput);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const scored = scoreResult(protocol, rawInput);

    const payload = {
      protocolSlug: protocol.slug,
      performedAt,
      attempts: rawInput.attempts,
      extras: rawInput.extras,
      measurementMethod: method,
      reliabilityLevel: reliability,
      conditions: conditions || null,
      notes: null,
    };

    startTransition(async () => {
      let resultId = "queued";
      let queuedOffline = false;

      if (isOffline()) {
        if (!enqueue({ kind: "test", payload })) {
          setError("No connection, and this device cannot store the result.");
          return;
        }
        notifyQueueChanged();
        queuedOffline = true;
      } else {
        try {
          const response = await submitTestResultAction(payload);
          if (!response.ok) {
            setError(response.message);
            return;
          }
          resultId = response.resultId ?? "new";
        } catch (error) {
          // Connection dropped mid-submit: queue rather than lose the test.
          if (!isNetworkError(error)) {
            setError((error as Error).message);
            return;
          }
          if (!enqueue({ kind: "test", payload })) {
            setError("No connection, and this device cannot store the result.");
            return;
          }
          notifyQueueChanged();
          queuedOffline = true;
        }
      }

      const sameVariant = history
        .filter((p) => p.variant === scored.variant)
        .sort((a, b) => a.date.localeCompare(b.date));
      const newPoint: MetricPoint = {
        date: performedAt,
        value: scored.value,
        reliability,
        protocolVersion: protocol.protocolVersion,
        resultId,
      };
      const points = [...sameVariant, newPoint].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const baseline = sameVariant.length > 0 ? sameVariant[0].value : null;
      const trend = computeTrend(points, protocol.improvementDirection);
      const change =
        baseline !== null
          ? computeChange(baseline, scored.value, protocol.improvementDirection)
          : null;

      setSummary({
        value: scored.value,
        baseline,
        best:
          bestValue(points.map((p) => p.value), protocol.improvementDirection) ??
          scored.value,
        trend: trend.trend,
        trendLabel: trend.label,
        changeVsBaselinePct: change?.percent ?? null,
        isImprovement: change?.isImprovement ?? false,
        reliability,
        observations: points.length,
        queuedOffline,
      });
      setStep(2);
      if (!queuedOffline) router.refresh();
    });
  }

  if (summary) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-[0.16em] text-chalk-600">
          {summary.queuedOffline ? "Saved on this device" : "Result saved"}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-chalk-100">{protocol.name}</h3>

        <dl className="mt-4 space-y-3">
          <Row label="Today" value={formatValue(summary.value, protocol.unit)} strong />
          <Row
            label="Baseline"
            value={
              summary.baseline === null
                ? "This result is your ZERO BASELINE"
                : formatValue(summary.baseline, protocol.unit)
            }
          />
          <Row label="Best" value={formatValue(summary.best, protocol.unit)} />
          <Row
            label="Vs baseline"
            value={
              summary.changeVsBaselinePct === null
                ? "—"
                : `${formatPercent(summary.changeVsBaselinePct)} (${
                    summary.isImprovement ? "progress" : "regression"
                  })`
            }
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TrendBadge trend={summary.trend} />
          <ReliabilityBadge level={summary.reliability} />
          <span className="text-[10px] uppercase tracking-[0.1em] text-chalk-600">
            {summary.observations} measurement{summary.observations > 1 ? "s" : ""}
          </span>
        </div>

        {summary.queuedOffline ? (
          <div className="mt-3">
            <Notice tone="warn">
              No connection: this result is stored on your phone and will be sent
              automatically once you are back online.
            </Notice>
          </div>
        ) : null}

        {summary.observations < 3 ? (
          <div className="mt-3">
            <Notice>
              A trend needs at least three measurements. Until then only the raw values
              are shown.
            </Notice>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="pz-button-ghost w-full"
            onClick={() => {
              setSummary(null);
              setStep(0);
              setAttempts(Array.from({ length: Math.max(attemptCount, 0) }, () => ""));
            }}
          >
            Run again
          </button>
          <Link
            href={`/progress?metric=${encodeURIComponent(
              protocol.slug + (preview?.variant ? `::${preview.variant}` : ""),
            )}`}
            className="pz-button"
          >
            See progression
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <ol className="mb-4 flex gap-2 text-[10px] uppercase tracking-[0.14em]">
        {STEP_LABELS.map((label, index) => (
          <li
            key={label}
            className={`flex-1 rounded-md py-1 text-center ${
              index === step ? "bg-signal/15 text-signal" : "bg-ink-800 text-chalk-600"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="space-y-4">
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
          <p className="text-xs text-chalk-600">
            Equipment: {protocol.equipment.join(", ")} · {protocol.attempts} attempt
            {protocol.attempts > 1 ? "s" : ""}
            {protocol.restSeconds > 0 ? ` · ${protocol.restSeconds}s rest` : ""}
          </p>
          <button type="button" className="pz-button" onClick={() => setStep(1)}>
            Start test
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          {attemptCount > 0 ? (
            <div className="space-y-3">
              <span className="pz-label">{protocol.attemptLabel}</span>
              {attempts.map((value, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-chalk-600">
                    #{index + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={protocol.unit === "s" ? "0.01" : "1"}
                    className="pz-input text-center font-mono text-lg"
                    value={value}
                    onChange={(event) => {
                      const next = [...attempts];
                      next[index] = event.target.value;
                      setAttempts(next);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {(protocol.extraFields ?? []).map((field) => (
            <div key={field.key}>
              <label className="pz-label mb-2" htmlFor={`extra-${field.key}`}>
                {field.label}
                {field.unit ? ` (${field.unit})` : ""}
              </label>
              {field.type === "select" ? (
                <select
                  id={`extra-${field.key}`}
                  className="pz-input"
                  value={extras[field.key] ?? ""}
                  onChange={(event) =>
                    setExtras({ ...extras, [field.key]: event.target.value })
                  }
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Decrease ${field.label}`}
                    className="pz-button-ghost h-12 w-14 text-lg"
                    onClick={() =>
                      setExtras({
                        ...extras,
                        [field.key]: String(
                          Math.max(
                            field.min ?? 0,
                            Number(extras[field.key] || 0) - (field.step ?? 1),
                          ),
                        ),
                      })
                    }
                  >
                    −
                  </button>
                  <input
                    id={`extra-${field.key}`}
                    type="number"
                    inputMode="decimal"
                    step={field.step ?? 1}
                    className="pz-input text-center font-mono text-lg"
                    value={extras[field.key] ?? ""}
                    onChange={(event) =>
                      setExtras({ ...extras, [field.key]: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${field.label}`}
                    className="pz-button-ghost h-12 w-14 text-lg"
                    onClick={() =>
                      setExtras({
                        ...extras,
                        [field.key]: String(
                          Math.min(
                            field.max ?? 9999,
                            Number(extras[field.key] || 0) + (field.step ?? 1),
                          ),
                        ),
                      })
                    }
                  >
                    +
                  </button>
                </div>
              )}
              {field.help ? (
                <p className="mt-1 text-xs text-chalk-600">{field.help}</p>
              ) : null}
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="pz-label mb-2" htmlFor="performedAt">
                Date
              </label>
              <input
                id="performedAt"
                type="date"
                className="pz-input"
                value={performedAt}
                onChange={(event) => setPerformedAt(event.target.value)}
              />
            </div>
            <div>
              <label className="pz-label mb-2" htmlFor="method">
                Measurement method
              </label>
              <select
                id="method"
                className="pz-input"
                value={method}
                onChange={(event) => setMethod(event.target.value as MeasurementMethod)}
              >
                {MEASUREMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {MEASUREMENT_METHOD_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="pz-label mb-2" htmlFor="reliability">
              Reliability of this measurement
            </label>
            <select
              id="reliability"
              className="pz-input"
              value={reliability}
              onChange={(event) =>
                setReliability(event.target.value as ReliabilityLevel)
              }
            >
              {RELIABILITY_LEVELS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-chalk-600">
              Protocol default: {protocol.defaultReliability}. Lower it if conditions
              were not standard.
            </p>
          </div>

          <div>
            <label className="pz-label mb-2" htmlFor="conditions">
              Conditions (optional)
            </label>
            <input
              id="conditions"
              className="pz-input"
              placeholder="Wet pitch, wind, indoor…"
              value={conditions}
              onChange={(event) => setConditions(event.target.value)}
            />
          </div>

          {preview ? (
            <p className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-sm text-chalk-300">
              Recorded value: {formatValue(preview.value, protocol.unit)}
            </p>
          ) : null}

          {error ? <p className="text-sm text-alert">{error}</p> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="pz-button-ghost w-full"
              onClick={() => setStep(0)}
            >
              Back to protocol
            </button>
            <button
              type="button"
              className="pz-button"
              onClick={submit}
              disabled={pending}
            >
              {pending ? "Saving…" : "Save result"}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-800 pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-[0.12em] text-chalk-600">{label}</dt>
      <dd
        className={`text-right font-mono tabular-nums ${
          strong ? "text-xl font-semibold text-chalk-100" : "text-sm text-chalk-300"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
