"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, getStore } from "@/lib/data";
import { sessionSchema } from "@/lib/validation/schemas";

export type ActionState = { ok: boolean; message: string };

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

export async function createSessionAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sessionSchema.safeParse({
    date: formData.get("date"),
    sessionType: formData.get("sessionType"),
    durationMinutes: formData.get("durationMinutes"),
    position: formData.get("position") || null,
    rpe: formData.get("rpe") ? formData.get("rpe") : null,
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid session" };
  }

  try {
    const userId = await requireUserId();
    const store = await getStore();
    await store.createSession(userId, parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/");
  revalidatePath("/sessions");
  return { ok: true, message: "Session saved" };
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const userId = await requireUserId();
  const store = await getStore();
  await store.deleteSession(userId, id);
  revalidatePath("/");
  revalidatePath("/sessions");
}
