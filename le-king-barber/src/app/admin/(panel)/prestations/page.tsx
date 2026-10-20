import { deleteServiceAction, saveServiceAction } from "@/actions/admin/services";
import { ActionForm, Submit } from "@/components/admin/form";
import { Card, Checkbox, Input, PageHeader, Textarea } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import type { Service } from "@/lib/types";

function ServiceFields({ s }: { s?: Service }) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Input label="Nom" name="name" defaultValue={s?.name} required maxLength={80} className="sm:col-span-2" />
      <Input label="Prix (€)" name="price" inputMode="decimal" defaultValue={s ? String(s.price_cents / 100).replace(".", ",") : ""} required />
      <Input label="Durée (min)" name="duration" type="number" min={5} max={480} step={5} defaultValue={s?.duration_minutes ?? ""} />
      <Textarea label="Description" name="description" defaultValue={s?.description ?? ""} rows={2} maxLength={500} className="sm:col-span-3" />
      <Input label="Ordre" name="sortOrder" type="number" min={0} defaultValue={s?.sort_order ?? 0} />
      <div className="sm:col-span-4">
        <Checkbox name="isActive" defaultChecked={s ? s.is_active : true} label="Proposée à la réservation en ligne" />
      </div>
    </div>
  );
}

export default async function ServicesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("services").select("*").order("sort_order").order("name");
  const services = (data ?? []) as Service[];
  return (
    <>
      <PageHeader title="Prestations" subtitle="Nom, prix, durée et disponibilité en ligne." />
      <div className="max-w-4xl space-y-6">
        {services.map((s) => (
          <Card key={s.id} title={s.is_active ? "En ligne" : "Masquée"}>
            {!s.duration_minutes && <p className="mb-4 text-sm text-champagne">Durée à renseigner avant de pouvoir la proposer en ligne.</p>}
            <ActionForm action={saveServiceAction.bind(null, s.id)}>
              <ServiceFields s={s} />
              <div className="mt-4 flex gap-3">
                <Submit>Enregistrer</Submit>
              </div>
            </ActionForm>
            <ActionForm action={deleteServiceAction.bind(null, s.id)} confirm={`Supprimer « ${s.name} » ? Les rendez-vous existants sont conservés.`} className="mt-3">
              <Submit variant="danger">Supprimer</Submit>
            </ActionForm>
          </Card>
        ))}
        <Card title="Nouvelle prestation">
          <ActionForm action={saveServiceAction.bind(null, null)} resetOnSuccess>
            <ServiceFields />
            <Submit className="mt-4">Ajouter</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
