import Link from "next/link";

import { deleteSessionAction } from "@/actions/session-actions";
import { DemoBadge } from "@/components/badges";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { loadPlayerData, trainingTotals } from "@/lib/data/queries";
import { SESSION_TYPE_LABELS, formatDate, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { sessions } = await loadPlayerData();
  const totals = trainingTotals(sessions);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sessions"
        subtitle={`${totals.sessions} sessions · ${totals.hours} h · ${totals.matches} matches`}
        action={
          <Link href="/sessions/new" className="pz-button-ghost shrink-0">
            + New
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total" value={totals.sessions} />
        <StatTile label="Hours" value={totals.hours} />
        <StatTile label="Last 7 days" value={totals.last7Days} />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          body="Log a session right after training — it takes about ten seconds."
          ctaHref="/sessions/new"
          ctaLabel="Log a session"
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-chalk-100">
                        {SESSION_TYPE_LABELS[session.sessionType]}
                      </p>
                      {session.isDemo ? <DemoBadge /> : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-chalk-600">
                      {formatDate(session.date)} · {formatDuration(session.durationMinutes)}
                      {session.position ? ` · ${session.position}` : ""}
                      {session.rpe ? ` · RPE ${session.rpe}` : ""}
                    </p>
                    {session.notes ? (
                      <p className="mt-2 text-sm text-chalk-500">{session.notes}</p>
                    ) : null}
                  </div>
                  <form action={deleteSessionAction}>
                    <input type="hidden" name="id" value={session.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1 text-xs text-chalk-600 transition hover:text-alert"
                      aria-label="Delete session"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
