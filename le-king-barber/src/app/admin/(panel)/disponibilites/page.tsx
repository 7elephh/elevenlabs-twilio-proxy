import { addBlockedPeriodAction, deleteBlockedPeriodAction } from "@/actions/admin/availability";
import { ActionForm, Submit } from "@/components/admin/form";
import { DayHoursEditor } from "@/components/admin/hours-editor";
import { Card, Empty, Input, PageHeader, Select } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, WEEKDAY_LABELS } from "@/lib/time";
import type { BlockedPeriod, BusinessHour } from "@/lib/types";

const KIND_LABELS = { vacation: "Congés", closure: "Fermeture exceptionnelle", block: "Créneau bloqué" } as const;

export default async function AvailabilityPage() {
  const { supabase } = await requireAdmin();
  const [{ data: hours }, { data: blocked }, { data: settings }] = await Promise.all([
    supabase.from("business_hours").select("*").order("opens_at"),
    supabase.from("blocked_periods").select("*").gt("ends_at", new Date().toISOString()).order("starts_at"),
    supabase.from("business_settings").select("timezone").eq("id", 1).single(),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";
  const h = (hours ?? []) as BusinessHour[];

  return (
    <>
      <PageHeader title="Horaires & congés" subtitle="Les créneaux proposés en ligne se mettent à jour immédiatement." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Horaires hebdomadaires">
          <p className="mb-2 text-xs text-ivoire/45">Plusieurs plages dans une journée créent une pause (ex. 9h–12h puis 14h–19h).</p>
          {WEEKDAY_LABELS.map((label, i) => (
            <DayHoursEditor
              key={label}
              weekday={i + 1}
              label={label}
              initial={h.filter((x) => x.weekday === i + 1).map((x) => ({ opens: x.opens_at.slice(0, 5), closes: x.closes_at.slice(0, 5) }))}
            />
          ))}
        </Card>

        <div className="space-y-6">
          <Card title="Ajouter un congé, une absence ou un blocage">
            <ActionForm action={addBlockedPeriodAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
              <Select label="Type" name="kind" className="sm:col-span-2">
                <option value="vacation">Congés</option>
                <option value="closure">Fermeture exceptionnelle</option>
                <option value="block">Bloquer un créneau</option>
              </Select>
              <Input label="Du" name="startDate" type="date" required />
              <Input label="À partir de (optionnel)" name="startTime" type="time" step={300} />
              <Input label="Au" name="endDate" type="date" hint="Vide = même jour" />
              <Input label="Jusqu'à (optionnel)" name="endTime" type="time" step={300} hint="Sans heure : journées entières" />
              <Input label="Motif (interne)" name="reason" maxLength={200} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <Submit>Ajouter</Submit>
              </div>
            </ActionForm>
          </Card>

          <Card title="Périodes à venir">
            {blocked?.length ? (
              <ul className="divide-y divide-ivoire/10">
                {(blocked as BlockedPeriod[]).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="text-sm">
                      <p>{KIND_LABELS[b.kind]}{b.reason ? ` — ${b.reason}` : ""}</p>
                      <p className="text-xs text-ivoire/50">
                        {formatDateTime(new Date(b.starts_at), tz)} → {formatDateTime(new Date(b.ends_at), tz)}
                      </p>
                    </div>
                    <ActionForm action={deleteBlockedPeriodAction.bind(null, b.id)} confirm="Supprimer cette période ?">
                      <Submit variant="danger">Supprimer</Submit>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune période bloquée à venir.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
