import { notFound } from "next/navigation";

import { anonymizeCustomerAction, saveCustomerNotesAction } from "@/actions/admin/customers";
import { BookingList } from "@/components/admin/booking-row";
import { ActionForm, Submit } from "@/components/admin/form";
import { Card, Empty, PageHeader, Textarea } from "@/components/admin/ui";
import { BOOKING_SELECT } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import type { BookingWithCustomer, Customer } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/validation";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data }, { data: bookings }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select(BOOKING_SELECT).eq("customer_id", id).order("starts_at", { ascending: false }),
    supabase.from("business_settings").select("timezone").eq("id", 1).single(),
  ]);
  if (!data) notFound();
  const c = data as Customer;
  const tz = settings?.timezone ?? "Europe/Paris";
  const list = (bookings ?? []) as BookingWithCustomer[];

  return (
    <>
      <PageHeader title={`${c.first_name} ${c.last_name}`} subtitle={`Client depuis le ${formatDateTime(new Date(c.created_at), tz)}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title={`Rendez-vous (${list.length})`}>
          {list.length ? <BookingList bookings={list} timezone={tz} showDate /> : <Empty>Aucun rendez-vous.</Empty>}
        </Card>
        <div className="space-y-6">
          <Card title="Coordonnées">
            {c.anonymized_at ? (
              <p className="text-sm text-ivoire/50">Données anonymisées.</p>
            ) : (
              <>
                <a href={`tel:${c.phone}`} className="block text-champagne">{formatPhoneDisplay(c.phone)}</a>
                {c.email && <a href={`mailto:${c.email}`} className="mt-1 block text-sm text-ivoire/70">{c.email}</a>}
              </>
            )}
          </Card>
          {!c.anonymized_at && (
            <>
              <Card title="Notes internes">
                <ActionForm action={saveCustomerNotesAction.bind(null, c.id)}>
                  <Textarea label="Préférences, habitudes…" name="notes" defaultValue={c.notes ?? ""} rows={4} hint="Visible uniquement par le salon. Évitez toute donnée sensible." />
                  <Submit className="mt-3">Enregistrer</Submit>
                </ActionForm>
              </Card>
              <Card title="RGPD">
                <p className="text-sm text-ivoire/60">Efface nom, téléphone, email et notes. L&apos;historique des rendez-vous est conservé de façon anonyme.</p>
                <ActionForm action={anonymizeCustomerAction.bind(null, c.id)} confirm="Effacer définitivement les données personnelles de ce client ?" className="mt-4">
                  <Submit variant="danger">Effacer les données</Submit>
                </ActionForm>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
