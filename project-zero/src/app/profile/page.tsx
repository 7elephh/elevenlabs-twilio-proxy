import { WeightBadge } from "@/components/badges";
import { DemoDataControls } from "@/components/demo-data-controls";
import { ProfileForm } from "@/components/profile-form";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { authEnabled, loadPlayerData } from "@/lib/data/queries";
import { effectiveWeight, roleProfile } from "@/lib/domain/positions";
import { activeProtocols } from "@/lib/domain/protocols";
import { WEIGHT_SCORE } from "@/lib/domain/positions";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile, sessions, results, checkpoints } = await loadPlayerData();

  const demoCount =
    sessions.filter((s) => s.isDemo).length +
    results.filter((r) => r.isDemo).length +
    checkpoints.filter((c) => c.isDemo).length;

  const weights = activeProtocols()
    .map((protocol) => ({
      protocol,
      weight: effectiveWeight(profile.primaryPosition, profile.preferredRole, protocol.slug),
    }))
    .sort((a, b) => WEIGHT_SCORE[b.weight] - WEIGHT_SCORE[a.weight]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        subtitle={
          profile.baselineDate
            ? `ZERO BASELINE set on ${formatDate(profile.baselineDate)}`
            : "No ZERO BASELINE yet — run your first test"
        }
      />

      <Card>
        <ProfileForm profile={profile} />
      </Card>

      <section>
        <SectionTitle
          title="Metric weights"
          hint={`${profile.primaryPosition} · ${roleProfile(profile.preferredRole).label}. Used for ordering only.`}
        />
        <Card>
          <ul className="space-y-2">
            {weights.map(({ protocol, weight }) => (
              <li key={protocol.slug} className="flex items-center justify-between gap-3">
                <span className="text-sm text-chalk-300">{protocol.name}</span>
                <WeightBadge weight={weight} />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle title="Demonstration data" hint="Seeded rows are flagged and removable in one click." />
        <Card>
          <DemoDataControls demoCount={demoCount} />
        </Card>
      </section>

      <section>
        <SectionTitle title="Account" />
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-chalk-600">Storage</dt>
              <dd className="font-mono text-chalk-300">
                {authEnabled ? "Supabase" : "Local file store"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-chalk-600">User</dt>
              <dd className="truncate font-mono text-xs text-chalk-300">
                {user.email ?? user.id}
              </dd>
            </div>
          </dl>
          {!authEnabled ? (
            <div className="mt-3">
              <Notice>
                Supabase is not configured, so data is stored in a local file and
                authentication is bypassed. Set NEXT_PUBLIC_SUPABASE_URL and
                NEXT_PUBLIC_SUPABASE_ANON_KEY to switch to the database.
              </Notice>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
