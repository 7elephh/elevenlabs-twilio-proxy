import { PageHeader } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
import { loadPlayerData } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function NewSessionPage() {
  const { profile } = await loadPlayerData();
  return (
    <div>
      <PageHeader
        title="Log a session"
        subtitle="Three fields are enough. Everything else is optional."
      />
      <SessionForm defaultPosition={profile.primaryPosition} />
    </div>
  );
}
