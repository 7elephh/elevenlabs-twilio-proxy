import Link from "next/link";

import { StatusBadge } from "@/components/admin/ui";
import { customerName } from "@/lib/admin-data";
import { formatDateLabel, localDateOf, localTimeOf } from "@/lib/time";
import { BOOKING_STATUS_LABELS, type BookingWithCustomer } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/validation";

export function BookingList({ bookings, timezone, showDate = false }: { bookings: BookingWithCustomer[]; timezone: string; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-ivoire/10">
      {bookings.map((b) => {
        const start = new Date(b.starts_at);
        return (
          <li key={b.id}>
            <Link href={`/admin/rendez-vous/${b.id}`} className="flex items-center gap-4 py-3.5 transition-colors hover:bg-ivoire/[0.03]">
              <div className="w-16 shrink-0 text-center">
                {showDate && <p className="text-[10px] uppercase tracking-[0.12em] text-ivoire/45">{formatDateLabel(localDateOf(start, timezone), "EEE d MMM")}</p>}
                <p className="font-serif text-2xl tabular-nums">{localTimeOf(start, timezone).replace(":", "h")}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate ${b.status === "cancelled" ? "text-ivoire/40 line-through" : ""}`}>{customerName(b)}</p>
                <p className="truncate text-xs text-ivoire/50">
                  {b.service_name} · {b.duration_minutes} min{b.customer?.phone && !b.customer.phone.startsWith("anon") ? ` · ${formatPhoneDisplay(b.customer.phone)}` : ""}
                </p>
              </div>
              {b.status !== "confirmed" && <StatusBadge status={b.status} label={BOOKING_STATUS_LABELS[b.status]} />}
              {b.source === "admin" && <span className="hidden text-[10px] uppercase tracking-[0.12em] text-ivoire/35 sm:inline">Manuel</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
