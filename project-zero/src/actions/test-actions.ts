"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, getStore } from "@/lib/data";
import { getProtocol } from "@/lib/domain/protocols";
import { scoreResult, validateRawInput } from "@/lib/domain/scoring";
import { testResultSchema } from "@/lib/validation/schemas";
import type { TestResult } from "@/lib/domain/types";

export type TestResultState = {
  ok: boolean;
  message: string;
  resultId?: string;
};

export type SubmitTestPayload = {
  protocolSlug: string;
  performedAt: string;
  attempts: number[];
  extras: Record<string, number | string>;
  measurementMethod: string;
  reliabilityLevel: string;
  conditions?: string | null;
  notes?: string | null;
};

/**
 * START TEST submission: validate, score with the protocol rules, persist with
 * the protocol version in force so future comparisons stay honest.
 */
export async function submitTestResultAction(
  payload: SubmitTestPayload,
): Promise<TestResultState> {
  const parsed = testResultSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid result" };
  }

  const protocol = getProtocol(parsed.data.protocolSlug);
  if (!protocol) return { ok: false, message: "Unknown protocol" };

  const raw = { attempts: parsed.data.attempts, extras: parsed.data.extras };
  const problem = validateRawInput(protocol, raw);
  if (problem) return { ok: false, message: problem };

  const scored = scoreResult(protocol, raw);

  let result: TestResult;
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Not signed in" };
    const store = await getStore();
    result = await store.createResult(user.id, {
      protocolSlug: protocol.slug,
      protocolVersion: protocol.protocolVersion,
      performedAt: parsed.data.performedAt,
      value: scored.value,
      attempts: scored.attempts,
      detail: scored.detail,
      variant: scored.variant,
      measurementMethod: parsed.data.measurementMethod,
      reliabilityLevel: parsed.data.reliabilityLevel,
      conditions: parsed.data.conditions ?? null,
      notes: parsed.data.notes ?? null,
    });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath("/tests");
  revalidatePath(`/tests/${protocol.slug}`);
  return { ok: true, message: "Result saved", resultId: result.id };
}

export async function deleteResultAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;
  const user = await getCurrentUser();
  if (!user) return;
  const store = await getStore();
  await store.deleteResult(user.id, id);
  revalidatePath("/");
  revalidatePath("/progress");
  if (slug) revalidatePath(`/tests/${slug}`);
}
