import Link from "next/link";

import { Card, Empty, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatPhoneDisplay } from "@/lib/validation";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin();
  const { q } = await searchParams;
  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, phone, email, created_at, bookings(count)")
    .is("anonymized_at", null)
    .order("last_name")
    .limit(200);
  const term = q?.trim().replace(/[%,()"\\*:]/g, "").slice(0, 60);
  if (term) {
    const digits = term.replace(/\D/g, "");
    const filters = [`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits.replace(/^0/, "")}%`);
    query = query.or(filters.join(","));
  }
  const { data } = await query;

  return (
    <>
      <PageHeader title="Clients" subtitle={`${data?.length ?? 0} client(s)`} />
      <form className="mb-6 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Nom, téléphone, email…" className="flex-1 border border-ivoire/15 bg-noir px-3 py-2.5 text-[15px] focus:border-champagne focus:outline-none" />
        <button className="border border-ivoire/25 px-4 text-[11px] font-semibold uppercase tracking-[0.14em]">Rechercher</button>
      </form>
      <Card>
        {data?.length ? (
          <ul className="divide-y divide-ivoire/10">
            {data.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`} className="flex items-center justify-between gap-4 py-3.5 hover:bg-ivoire/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate">{c.first_name} {c.last_name}</p>
                    <p className="truncate text-xs text-ivoire/50">{formatPhoneDisplay(c.phone)}{c.email ? ` · ${c.email}` : ""}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ivoire/45">{(c.bookings as unknown as { count: number }[])[0]?.count ?? 0} rdv</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun client.</Empty>
        )}
      </Card>
    </>
  );
}
