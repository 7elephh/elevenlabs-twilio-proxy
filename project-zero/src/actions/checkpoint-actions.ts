"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, getStore } from "@/lib/data";
import { buildCheckpoint } from "@/lib/domain/checkpoints";
import { checkpointSchema } from "@/lib/validation/schemas";

export type ActionState = { ok: boolean; message: string };

/**
 * A checkpoint is generated, never typed: sessions, hours, matches and every
 * metric summary are recomputed from the stored history at that date.
 */
export async function createCheckpointAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = checkpointSchema.safeParse({
    date: formData.get("date"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid checkpoint" };
  }

  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Not signed in" };
    const store = await getStore();

    const [sessions, results, checkpoints] = await Promise.all([
      store.listSessions(user.id),
      store.listResults(user.id),
      store.listCheckpoints(user.id),
    ]);

    const previous = checkpoints
      .filter((c) => c.date < parsed.data.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const draft = buildCheckpoint({
      userId: user.id,
      date: parsed.data.date,
      kind: parsed.data.kind,
      sessions,
      results,
      previousCheckpointDate: previous?.date ?? null,
      notes: parsed.data.notes ?? null,
    });

    await store.createCheckpoint(user.id, draft);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/");
  revalidatePath("/checkpoints");
  return { ok: true, message: "Checkpoint created" };
}

export async function deleteCheckpointAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const user = await getCurrentUser();
  if (!user) return;
  const store = await getStore();
  await store.deleteCheckpoint(user.id, id);
  revalidatePath("/checkpoints");
}
