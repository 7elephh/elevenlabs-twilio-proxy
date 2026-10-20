import { createAdminBookingAction } from "@/actions/admin/bookings";
import { ActionForm, Submit } from "@/components/admin/form";
import { Card, Checkbox, Input, PageHeader, Select, Textarea } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDuration, formatPrice, isValidDateString, localDateOf } from "@/lib/time";
import type { Service } from "@/lib/types";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ date?: string; heure?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const [{ data: services }, { data: settings }] = await Promise.all([
    supabase.from("services").select("*").not("duration_minutes", "is", null).order("sort_order"),
    supabase.from("business_settings").select("timezone").eq("id", 1).single(),
  ]);
  const date = sp.date && isValidDateString(sp.date) ? sp.date : localDateOf(new Date(), settings?.timezone ?? "Europe/Paris");
  const time = sp.heure && /^\d{2}:\d{2}$/.test(sp.heure) ? sp.heure : "";

  return (
    <>
      <PageHeader title="Nouveau rendez-vous" subtitle="Ajout manuel (téléphone, passage au salon…)." />
      <ActionForm action={createAdminBookingAction} className="grid max-w-3xl gap-6">
        <Card title="Rendez-vous">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Prestation" name="serviceId" required className="sm:col-span-3">
              {((services ?? []) as Service[]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatPrice(s.price_cents)} · {formatDuration(s.duration_minutes ?? 0)}
                  {s.is_active ? "" : " (inactive en ligne)"}
                </option>
              ))}
            </Select>
            <Input label="Date" name="date" type="date" defaultValue={date} required />
            <Input label="Heure" name="time" type="time" step={300} defaultValue={time} required />
          </div>
          <div className="mt-4">
            <Checkbox name="force" label="Forcer (ignorer horaires, pauses et congés — un autre rendez-vous reste bloquant)" />
          </div>
        </Card>
        <Card title="Client">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Téléphone" name="phone" type="tel" required hint="Retrouve automatiquement un client existant." />
            <Input label="Email (facultatif)" name="email" type="email" />
            <Input label="Prénom" name="firstName" required />
            <Input label="Nom" name="lastName" required />
            <Textarea label="Note interne" name="adminNote" rows={3} className="sm:col-span-2" />
          </div>
          <div className="mt-4">
            <Checkbox name="notify" defaultChecked label="Envoyer la confirmation par email (si renseigné)" />
          </div>
        </Card>
        <div>
          <Submit>Enregistrer le rendez-vous</Submit>
        </div>
      </ActionForm>
    </>
  );
}
