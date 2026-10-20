import Link from "next/link";

import { BookingList } from "@/components/admin/booking-row";
import { Card, Empty, PageHeader } from "@/components/admin/ui";
import { BOOKING_SELECT } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import type { BookingWithCustomer } from "@/lib/types";

const FILTERS = [
  { id: "a-venir", label: "À venir" },
  { id: "passes", label: "Historique" },
  { id: "annules", label: "Annulés" },
] as const;
const PAGE = 30;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.filtre)?.id ?? "a-venir";
  const page = Math.max(1, Number(sp.page) || 1);
  const { data: settings } = await supabase.from("business_settings").select("timezone").eq("id", 1).single();
  const now = new Date().toISOString();

  let q = supabase.from("bookings").select(BOOKING_SELECT, { count: "exact" });
  if (filter === "a-venir") q = q.neq("status", "cancelled").gte("ends_at", now).order("starts_at");
  if (filter === "passes") q = q.neq("status", "cancelled").lt("ends_at", now).order("starts_at", { ascending: false });
  if (filter === "annules") q = q.eq("status", "cancelled").order("starts_at", { ascending: false });
  const { data, count } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <>
      <PageHeader
        title="Rendez-vous"
        subtitle={`${count ?? 0} résultat(s)`}
        actions={<Link href="/admin/rendez-vous/nouveau" className="bg-ivoire px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-noir hover:bg-champagne">+ Rendez-vous</Link>}
      />
      <div className="mb-6 flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link key={f.id} href={`/admin/rendez-vous?filtre=${f.id}`} className={`whitespace-nowrap px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${filter === f.id ? "bg-ivoire/10 text-ivoire" : "text-ivoire/50 hover:text-ivoire"}`}>
            {f.label}
          </Link>
        ))}
      </div>
      <Card>
        {data?.length ? <BookingList bookings={data as BookingWithCustomer[]} timezone={settings?.timezone ?? "Europe/Paris"} showDate /> : <Empty>Aucun rendez-vous.</Empty>}
      </Card>
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-ivoire/60">
          {page > 1 ? <Link href={`/admin/rendez-vous?filtre=${filter}&page=${page - 1}`}>← Précédent</Link> : <span />}
          <span>Page {page} / {pages}</span>
          {page < pages ? <Link href={`/admin/rendez-vous?filtre=${filter}&page=${page + 1}`}>Suivant →</Link> : <span />}
        </div>
      )}
    </>
  );
}
