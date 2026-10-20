import "server-only";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { SITE_URL } from "@/lib/env";
import { isGoogleConfigured, serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Interval } from "@/lib/booking/availability";
import { zonedWallTimeToUtc } from "@/lib/time";

/**
 * Intégration Google Calendar — synchronisation SECONDAIRE.
 * - Sens site → Google : création / mise à jour / suppression d'un évènement par rendez-vous.
 * - Option « importer les occupations » : les évènements du calendrier Google (hors ceux
 *   créés par le site) bloquent les créneaux correspondants, avec repli silencieux si
 *   Google ne répond pas.
 * Les modifications faites directement dans Google sur un évènement du salon ne sont PAS
 * reportées dans la base (pas de synchronisation bidirectionnelle).
 */

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const API = "https://www.googleapis.com/calendar/v3";
const BOOKING_PROPERTY = "lkbBookingId";

export const googleRedirectUri = () => `${SITE_URL}/api/google/oauth/callback`;

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: serverEnv.googleClientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  expires_in: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: serverEnv.googleClientId,
      client_secret: serverEnv.googleClientSecret,
      ...body,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? `HTTP ${res.status}`);
  return json;
}

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/** Échange le code OAuth et enregistre le jeton de rafraîchissement chiffré. */
export async function completeGoogleConnection(code: string, userId: string): Promise<void> {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  if (!tokens.refresh_token) {
    throw new Error("Google n'a pas fourni de jeton de rafraîchissement. Révoquez l'accès puis reconnectez-vous.");
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("calendar_integrations").upsert({
    provider: "google",
    account_email: emailFromIdToken(tokens.id_token),
    calendar_id: "primary",
    refresh_token_encrypted: encryptSecret(tokens.refresh_token, serverEnv.googleTokenEncryptionKey),
    scopes: tokens.scope ?? GOOGLE_SCOPES.join(" "),
    connected_by: userId,
    connected_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) throw new Error(error.message);
}

interface Integration {
  calendar_id: string;
  refresh_token_encrypted: string;
  import_busy: boolean;
}

async function loadIntegration(): Promise<Integration | null> {
  if (!isGoogleConfigured()) return null;
  const { data } = await createServiceClient()
    .from("calendar_integrations")
    .select("calendar_id, refresh_token_encrypted, import_busy")
    .eq("provider", "google")
    .maybeSingle();
  return data;
}

let accessCache: { token: string; expiresAt: number; source: string } | null = null;

async function accessToken(integration: Integration): Promise<string> {
  if (accessCache && accessCache.source === integration.refresh_token_encrypted && accessCache.expiresAt > Date.now() + 60_000) {
    return accessCache.token;
  }
  const refresh = decryptSecret(integration.refresh_token_encrypted, serverEnv.googleTokenEncryptionKey);
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  accessCache = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000, source: integration.refresh_token_encrypted };
  return t.access_token;
}

async function gfetch(integration: Integration, path: string, init: RequestInit = {}, timeoutMs = 8000) {
  const token = await accessToken(integration);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function recordError(message: string | null) {
  await createServiceClient().from("calendar_integrations").update({ last_error: message }).eq("provider", "google");
}

/** Répercute l'état d'un rendez-vous dans Google Calendar. Ne lève jamais d'exception. */
export async function syncBookingToGoogle(bookingId: string): Promise<void> {
  let integration: Integration | null = null;
  const supabase = createServiceClient();
  try {
    integration = await loadIntegration();
    if (!integration) return;
    const { data: b } = await supabase
      .from("bookings")
      .select("id, status, starts_at, ends_at, service_name, customer_note, google_event_id, customer:customers(first_name, last_name, phone)")
      .eq("id", bookingId)
      .single();
    if (!b) return;
    const cal = encodeURIComponent(integration.calendar_id);
    const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;

    if (b.status === "cancelled") {
      if (b.google_event_id) {
        const res = await gfetch(integration, `/calendars/${cal}/events/${encodeURIComponent(b.google_event_id)}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google DELETE ${res.status}`);
      }
      await supabase.from("bookings").update({ google_event_id: null, google_synced_at: new Date().toISOString(), google_sync_error: null }).eq("id", b.id);
      return;
    }

    const event = {
      summary: `${b.service_name} — ${customer ? `${customer.first_name} ${customer.last_name}` : "Client"}`,
      description: [customer?.phone ? `Tél. ${customer.phone}` : null, b.customer_note ? `Note : ${b.customer_note}` : null, "Rendez-vous géré par le site Le King Barber."]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: b.starts_at },
      end: { dateTime: b.ends_at },
      extendedProperties: { private: { [BOOKING_PROPERTY]: b.id } },
      reminders: { useDefault: true },
    };
    const res = b.google_event_id
      ? await gfetch(integration, `/calendars/${cal}/events/${encodeURIComponent(b.google_event_id)}`, { method: "PATCH", body: JSON.stringify(event) })
      : await gfetch(integration, `/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(event) });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) throw new Error(json.error?.message ?? `Google ${res.status}`);
    await supabase
      .from("bookings")
      .update({ google_event_id: json.id, google_synced_at: new Date().toISOString(), google_sync_error: null })
      .eq("id", b.id);
    await recordError(null);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    await supabase.from("bookings").update({ google_sync_error: message.slice(0, 300) }).eq("id", bookingId);
    if (integration) await recordError(message.slice(0, 300));
  }
}

/**
 * Occupations du calendrier Google sur une période (hors évènements créés par le site).
 * En cas d'échec ou de délai dépassé, renvoie une liste vide : la réservation reste possible.
 */
export async function fetchGoogleBusy(from: Date, to: Date, timezone: string): Promise<Interval[]> {
  try {
    const integration = await loadIntegration();
    if (!integration?.import_busy) return [];
    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      maxResults: "250",
      fields: "items(start,end,transparency,status,extendedProperties)",
    });
    const res = await gfetch(integration, `/calendars/${encodeURIComponent(integration.calendar_id)}/events?${params}`, {}, 2500);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: {
        status?: string;
        transparency?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        extendedProperties?: { private?: Record<string, string> };
      }[];
    };
    return (json.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent" && !e.extendedProperties?.private?.[BOOKING_PROPERTY])
      .flatMap((e) => {
        // Évènement à heure fixe, ou journée entière (congé saisi dans Google).
        if (e.start?.dateTime && e.end?.dateTime) return [{ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }];
        if (e.start?.date && e.end?.date) {
          return [{ start: zonedWallTimeToUtc(e.start.date, "00:00", timezone), end: zonedWallTimeToUtc(e.end.date, "00:00", timezone) }];
        }
        return [];
      });
  } catch {
    return [];
  }
}

export async function disconnectGoogle(): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("calendar_integrations").select("refresh_token_encrypted").eq("provider", "google").maybeSingle();
  if (data && isGoogleConfigured()) {
    try {
      const token = decryptSecret(data.refresh_token_encrypted, serverEnv.googleTokenEncryptionKey);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", signal: AbortSignal.timeout(5000) });
    } catch {
      // La suppression locale prime : le jeton est de toute façon effacé.
    }
  }
  accessCache = null;
  await supabase.from("calendar_integrations").delete().eq("provider", "google");
}
