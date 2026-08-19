import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isSupabaseConfigured) redirect("/");
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader title="Sign in" subtitle="PROJECT ZERO — Football Development System" />
      <Card>
        <LoginForm />
      </Card>
    </div>
  );
}
