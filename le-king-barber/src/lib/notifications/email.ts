import "server-only";

import { isEmailConfigured, serverEnv } from "@/lib/server-env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: { filename: string; content: string; contentType?: string }[];
}

export type EmailResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/** Envoi via l'API Resend (https://resend.com). Aucun envoi simulé. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isEmailConfigured()) return { status: "skipped", reason: "email_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: serverEnv.emailFrom,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo || undefined,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
          content_type: a.contentType,
        })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) return { status: "failed", error: body.message ?? `HTTP ${res.status}` };
    return { status: "sent", id: body.id };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "unknown_error" };
  }
}
