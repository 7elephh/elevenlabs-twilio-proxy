"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createSessionAction } from "@/actions/session-actions";
import { sessionSchema } from "@/lib/validation/schemas";
import { POSITIONS, SESSION_TYPES } from "@/lib/domain/types";
import type { Position, SessionType } from "@/lib/domain/types";
import { SESSION_TYPE_LABELS, todayIso } from "@/lib/format";

type FormValues = {
  date: string;
  sessionType: SessionType;
  durationMinutes: number;
  position: Position | null;
  rpe: number | null;
  notes: string | null;
};

const DURATION_PRESETS = [45, 60, 75, 90, 120];

/**
 * Quick entry: five taps and done. Only date, type and duration are required —
 * position, RPE and notes stay optional on purpose.
 */
export function SessionForm({ defaultPosition }: { defaultPosition: Position | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(sessionSchema) as any,
    defaultValues: {
      date: todayIso(),
      sessionType: "TEAM_TRAINING",
      durationMinutes: 90,
      position: defaultPosition,
      rpe: null,
      notes: null,
    },
  });

  const duration = watch("durationMinutes");

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const formData = new FormData();
    formData.set("date", values.date);
    formData.set("sessionType", values.sessionType);
    formData.set("durationMinutes", String(values.durationMinutes));
    if (values.position) formData.set("position", values.position);
    if (values.rpe) formData.set("rpe", String(values.rpe));
    if (values.notes) formData.set("notes", values.notes);

    startTransition(async () => {
      const result = await createSessionAction(null, formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/sessions");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <span className="pz-label mb-2">Type</span>
        <Controller
          control={control}
          name="sessionType"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => field.onChange(type)}
                  className={`min-h-[52px] rounded-xl border px-3 text-sm font-semibold transition ${
                    field.value === type
                      ? "border-signal bg-signal/15 text-signal"
                      : "border-ink-700 bg-ink-900 text-chalk-300"
                  }`}
                >
                  {SESSION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div>
        <span className="pz-label mb-2">Duration</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease duration"
            className="pz-button-ghost h-14 w-16 text-xl"
            onClick={() =>
              setValue("durationMinutes", Math.max(5, Number(duration) - 15), {
                shouldValidate: true,
              })
            }
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            className="pz-input text-center font-mono text-xl"
            {...register("durationMinutes", { valueAsNumber: true })}
          />
          <button
            type="button"
            aria-label="Increase duration"
            className="pz-button-ghost h-14 w-16 text-xl"
            onClick={() =>
              setValue("durationMinutes", Math.min(600, Number(duration) + 15), {
                shouldValidate: true,
              })
            }
          >
            +
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setValue("durationMinutes", preset, { shouldValidate: true })}
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-chalk-500"
            >
              {preset} min
            </button>
          ))}
        </div>
        {errors.durationMinutes ? (
          <p className="mt-1 text-xs text-alert">{errors.durationMinutes.message}</p>
        ) : null}
      </div>

      <div>
        <label className="pz-label mb-2" htmlFor="date">
          Date
        </label>
        <input id="date" type="date" className="pz-input" {...register("date")} />
      </div>

      <details className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
        <summary className="cursor-pointer text-sm font-medium text-chalk-500">
          Optional details
        </summary>

        <div className="mt-4 space-y-4">
          <div>
            <span className="pz-label mb-2">RPE (1–10)</span>
            <Controller
              control={control}
              name="rpe"
              render={({ field }) => (
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(field.value === value ? null : value)}
                      className={`min-h-[44px] rounded-lg border font-mono text-sm transition ${
                        field.value === value
                          ? "border-signal bg-signal/15 text-signal"
                          : "border-ink-700 bg-ink-900 text-chalk-500"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <label className="pz-label mb-2" htmlFor="position">
              Position played
            </label>
            <select id="position" className="pz-input" {...register("position")}>
              <option value="">—</option>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="pz-label mb-2" htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" rows={2} className="pz-input" {...register("notes")} />
          </div>
        </div>
      </details>

      {error ? <p className="text-sm text-alert">{error}</p> : null}

      <button type="submit" className="pz-button" disabled={pending}>
        {pending ? "Saving…" : "Save session"}
      </button>
    </form>
  );
}
