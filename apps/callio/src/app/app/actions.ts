"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireSession, ACTIVE_COMPANY_COOKIE } from "@/lib/auth/session";
import { companySelectionSchema } from "@/lib/validation/schemas";

/**
 * Change l'entreprise active.
 *
 * L'identifiant recu est confronte aux entreprises de l'utilisateur avant
 * d'etre ecrit : un identifiant arbitraire est ignore, et la RLS constituerait
 * de toute facon la derniere barriere.
 */
export async function selectCompanyAction(formData: FormData): Promise<void> {
  const parsed = companySelectionSchema.safeParse({
    companyId: formData.get("companyId"),
  });
  if (!parsed.success) return;

  const session = await requireSession();
  const allowed = session.companies.some((c) => c.id === parsed.data.companyId);
  if (!allowed) return;

  (await cookies()).set(ACTIVE_COMPANY_COOKIE, parsed.data.companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/app", "layout");
}
