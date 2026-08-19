"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, getStore } from "@/lib/data";
import { profileSchema } from "@/lib/validation/schemas";
import type { Position } from "@/lib/domain/types";

export type ActionState = { ok: boolean; message: string };

export async function saveProfileAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    primaryPosition: formData.get("primaryPosition"),
    secondaryPositions: formData.getAll("secondaryPositions") as Position[],
    preferredRole: formData.get("preferredRole"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }

  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Not signed in" };
    const store = await getStore();
    await store.saveProfile(user.id, parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, message: "Profile saved" };
}

export async function clearDemoDataAction(): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Not signed in" };
    const store = await getStore();
    const counts = await store.clearDemoData(user.id);
    revalidatePath("/");
    revalidatePath("/sessions");
    revalidatePath("/progress");
    revalidatePath("/checkpoints");
    revalidatePath("/tests");
    return {
      ok: true,
      message: `Demo data removed: ${counts.sessions} sessions, ${counts.results} test results, ${counts.checkpoints} checkpoints.`,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
