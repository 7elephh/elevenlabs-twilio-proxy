import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelBookingAdminAction, setBookingStatusAction, updateBookingAction } from "@/actions/admin/bookings";
import { ActionForm, Submit } from "@/components/admin/form";
import { Card, Checkbox, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/admin/ui";
import { BOOKING_SELECT, customerName } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatDuration, formatPrice, localDateOf, localTimeOf } from "@/lib/time";
import { BOOKING_STATUS_LABELS, type BookingWithCustomer, type Service } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/validation";

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const { supabase } = await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data }, { data: services }, { data: settings }, { data: notifications }] = await Promise.all([
    supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle(),
    supabase.from("services").select("*").not("duration_minutes", "is", null).order("sort_order"),
    supabase.from("business_settings").select("timezone").eq("id", 1).single(),
    supabase.from("notification_log").select("kind, status, error, created_at").eq("booking_id", id).order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const b = data as BookingWithCustomer;
  const tz = settings?.timezone ?? "Europe/Paris";
  const start = new Date(b.starts_at);
  const editable = b.status !== "cancelled";
  const phone = b.customer?.phone && !b.customer.phone.startsWith("anon") ? b.customer.phone : null;

  return (
    <>
      <PageHeader
        title={customerName(b)}
        subtitle={<span className="inline-block first-letter:uppercase">{formatDateTime(start, tz)}</span>}
        actions={<StatusBadge status={b.status} label={BOOKING_STATUS_LABELS[b.status]} />}
      />
      {sp.cree && <p className="mb-6 border-l-2 border-champagne px-4 py-2 text-sm text-champagne">Rendez-vous créé.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {editable ? (
            <Card title="Modifier">
              <ActionForm action={updateBookingAction.bind(null, b.id)} className="grid gap-4 sm:grid-cols-2">
                <Select label="Prestation" name="serviceId" defaultValue={b.service_id ?? ""} className="sm:col-span-2">
                  {!b.service_id && <option value="">{b.service_name} (supprimée)</option>}
                  {((services ?? []) as Service[]).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price_cents)} · {formatDuration(s.duration_minutes ?? 0)}</option>
                  ))}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={localDateOf(start, tz)} required />
                <Input label="Heure" name="time" type="time" step={300} defaultValue={localTimeOf(start, tz)} required />
                <Textarea label="Note interne" name="adminNote" defaultValue={b.admin_note ?? ""} rows={3} className="sm:col-span-2" />
                <div className="space-y-2 sm:col-span-2">
                  <Checkbox name="notify" defaultChecked label="Prévenir le client par email en cas de changement d'horaire" />
                  <Checkbox name="force" label="Forcer (ignorer horaires, pauses et congés)" />
                </div>
                <div className="sm:col-span-2">
                  <Submit>Enregistrer</Submit>
                </div>
              </ActionForm>
            </Card>
          ) : (
            <Card title="Annulé">
              <p className="text-sm text-ivoire/60">
                Annulé {b.cancelled_by === "customer" ? "par le client" : "par le salon"}
                {b.cancelled_at ? ` le ${formatDateTime(new Date(b.cancelled_at), tz)}` : ""}.
              </p>
            </Card>
          )}

          {editable && (
            <Card title="Statut">
              <div className="flex flex-wrap gap-3">
                {(["completed", "no_show", "confirmed"] as const)
                  .filter((s) => s !== b.status)
                  .map((s) => (
                    <ActionForm key={s} action={setBookingStatusAction.bind(null, b.id)}>
                      <input type="hidden" name="status" value={s} />
                      <Submit variant="outline">{s === "completed" ? "Marquer honoré" : s === "no_show" ? "Client absent" : "Remettre confirmé"}</Submit>
                    </ActionForm>
                  ))}
              </div>
              <ActionForm action={cancelBookingAdminAction.bind(null, b.id)} confirm="Annuler ce rendez-vous ?" className="mt-6 border-t border-ivoire/10 pt-6">
                <Checkbox name="notify" defaultChecked label="Prévenir le client par email" />
                <Submit variant="danger" className="mt-4">Annuler le rendez-vous</Submit>
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Détails">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ivoire/50">Prestation</dt><dd>{b.service_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivoire/50">Durée</dt><dd>{formatDuration(b.duration_minutes)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivoire/50">Tarif</dt><dd>{formatPrice(b.price_cents)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivoire/50">Origine</dt><dd>{b.source === "online" ? "Site" : "Manuel"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ivoire/50">Créé le</dt><dd>{formatDateTime(new Date(b.created_at), tz)}</dd></div>
              {b.google_sync_error && <div className="text-xs text-red-300">Google : {b.google_sync_error}</div>}
            </dl>
            {b.customer_note && <p className="mt-4 border-t border-ivoire/10 pt-4 text-sm text-ivoire/75">« {b.customer_note} »</p>}
          </Card>
          {b.customer && (
            <Card title="Client" action={<Link href={`/admin/clients/${b.customer.id}`} className="text-xs text-ivoire/50 hover:text-ivoire">Fiche →</Link>}>
              <p>{customerName(b)}</p>
              {phone && <a href={`tel:${phone}`} className="mt-2 block text-champagne">{formatPhoneDisplay(phone)}</a>}
              {b.customer.email && <a href={`mailto:${b.customer.email}`} className="mt-1 block text-sm text-ivoire/70">{b.customer.email}</a>}
            </Card>
          )}
          <Card title="Notifications">
            {notifications?.length ? (
              <ul className="space-y-2 text-xs">
                {notifications.map((n, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ivoire/70">{n.kind}</span>
                    <span className={n.status === "sent" ? "text-champagne" : n.status === "failed" ? "text-red-300" : "text-ivoire/40"}>
                      {n.status === "sent" ? "envoyé" : n.status === "failed" ? "échec" : "non envoyé (email non configuré)"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ivoire/45">Aucune notification envoyée.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
