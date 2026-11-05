import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm, WorkspaceForm } from "@/components/settings/forms";
import { createClient } from "@/lib/supabase/server";
import { timeZoneOptions } from "@/lib/timezones";
import { getPersonalWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings · KARA Finance" };

export default async function SettingsPage() {
  const { user, workspace } = await getPersonalWorkspace();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  const timezones = timeZoneOptions();
  if (!timezones.includes(workspace.timezone)) timezones.unshift(workspace.timezone);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-midnight">Settings</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm displayName={profile?.display_name ?? ""} email={user.email} />
        <WorkspaceForm
          name={workspace.name}
          timezone={workspace.timezone}
          baseCurrency={workspace.base_currency}
          timezones={timezones}
        />
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-midnight/10">
        <h2 className="font-semibold text-midnight">Security</h2>
        <Link href="/reset-password" className="mt-2 inline-block text-sm text-[#1d6fc4] underline-offset-2 hover:underline">
          Change password
        </Link>
      </div>
    </section>
  );
}
