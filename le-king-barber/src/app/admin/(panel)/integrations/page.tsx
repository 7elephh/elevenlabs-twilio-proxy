import { disconnectGoogleAction, resyncGoogleAction, sendTestEmailAction, setGoogleImportBusyAction } from "@/actions/admin/integrations";
import { ActionForm, Submit } from "@/components/admin/form";
import { Card, Checkbox, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { isEmailConfigured, isGoogleConfigured, serverEnv } from "@/lib/server-env";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { formatDateTime } from "@/lib/time";

const GOOGLE_MESSAGES: Record<string, string> = {
  connecte: "Google Calendar est connecté.",
  refuse: "Connexion refusée sur Google.",
  "etat-invalide": "Session expirée, merci de recommencer.",
  erreur: "La connexion a échoué. Vérifiez la configuration OAuth.",
  "non-configure": "Les identifiants Google ne sont pas configurés sur le serveur.",
};

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-champagne" : "bg-ivoire/25"}`} />
      {children}
    </p>
  );
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await requireAdmin();
  const { google: googleStatus } = await searchParams;
  const integration = isServiceConfigured()
    ? (await createServiceClient().from("calendar_integrations").select("account_email, import_busy, last_error, connected_at").eq("provider", "google").maybeSingle()).data
    : null;

  return (
    <>
      <PageHeader title="Intégrations" subtitle="Services externes : tous optionnels, la réservation fonctionne sans eux." />
      <div className="grid max-w-4xl gap-6">
        <Card title="Google Calendar">
          {googleStatus && <p className="mb-4 text-sm text-champagne">{GOOGLE_MESSAGES[googleStatus] ?? ""}</p>}
          <p className="mb-5 text-sm leading-relaxed text-ivoire/60">
            Chaque rendez-vous du site est copié dans votre agenda Google (création, modification, annulation). La base du site reste la référence :
            modifier un rendez-vous directement dans Google ne le modifie pas sur le site.
          </p>
          {!isGoogleConfigured() ? (
            <Status ok={false}>Non configuré sur le serveur (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY).</Status>
          ) : integration ? (
            <div className="space-y-5">
              <Status ok>
                Connecté{integration.account_email ? ` à ${integration.account_email}` : ""} depuis le {formatDateTime(new Date(integration.connected_at), "Europe/Paris")}
              </Status>
              {integration.last_error && <p className="text-xs text-red-300">Dernière erreur : {integration.last_error}</p>}
              <ActionForm action={setGoogleImportBusyAction} className="space-y-3">
                <Checkbox name="import_busy" defaultChecked={integration.import_busy} label="Bloquer les créneaux où j'ai déjà un évènement dans Google Calendar" />
                <Submit variant="outline">Enregistrer</Submit>
              </ActionForm>
              <div className="flex flex-wrap gap-3 border-t border-ivoire/10 pt-5">
                <ActionForm action={resyncGoogleAction}>
                  <Submit variant="outline">Resynchroniser les rendez-vous à venir</Submit>
                </ActionForm>
                <ActionForm action={disconnectGoogleAction} confirm="Déconnecter Google Calendar ?">
                  <Submit variant="danger">Déconnecter</Submit>
                </ActionForm>
              </div>
            </div>
          ) : (
            <a href="/api/google/oauth/start" className="inline-block bg-ivoire px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-noir hover:bg-champagne">
              Connecter mon Google Calendar
            </a>
          )}
        </Card>

        <Card title="Emails (Resend)">
          <div className="space-y-2">
            <Status ok={isEmailConfigured()}>{isEmailConfigured() ? `Expéditeur : ${serverEnv.emailFrom}` : "Non configuré (RESEND_API_KEY, EMAIL_FROM) — aucun email n'est envoyé."}</Status>
            <Status ok={Boolean(serverEnv.barberNotificationEmail)}>
              {serverEnv.barberNotificationEmail ? `Alertes salon : ${serverEnv.barberNotificationEmail}` : "Alertes salon désactivées (BARBER_NOTIFICATION_EMAIL)."}
            </Status>
            <Status ok={Boolean(serverEnv.cronSecret)}>{serverEnv.cronSecret ? "Rappels quotidiens actifs (veille du rendez-vous)." : "Rappels inactifs (CRON_SECRET)."}</Status>
          </div>
          {isEmailConfigured() && (
            <ActionForm action={sendTestEmailAction} className="mt-5">
              <Submit variant="outline">Envoyer un email de test</Submit>
            </ActionForm>
          )}
        </Card>

        <Card title="Serveur">
          <div className="space-y-2">
            <Status ok={isServiceConfigured()}>Clé service Supabase (moteur de réservation)</Status>
            <Status ok={Boolean(serverEnv.manageTokenSecret)}>Secret des liens de gestion client (MANAGE_TOKEN_SECRET)</Status>
            <Status ok={!SITE_URL.includes("localhost")}>Adresse publique du site : {SITE_URL}</Status>
          </div>
        </Card>
      </div>
    </>
  );
}
