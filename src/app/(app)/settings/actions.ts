"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupportedTimeZone } from "@/lib/timezones";
import { getPersonalWorkspace } from "@/lib/workspace";

export type SettingsState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "workspaceName" | "timezone", string>>;
};

const GENERIC_ERROR = "Couldn't save. Please try again.";

export async function updateProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim() : "";
  if (displayName.length > 100) {
    return { status: "error", fieldErrors: { displayName: "Use 100 characters or fewer." } };
  }

  // The row is always the signed-in user's own; nothing is taken from the form.
  const { user } = await getPersonalWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/", "layout");
  return { status: "success", message: "Profile saved." };
}

export async function updateWorkspace(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const rawName = formData.get("workspaceName");
  const rawTz = formData.get("timezone");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const timezone = typeof rawTz === "string" ? rawTz : "";

  if (name.length < 1 || name.length > 100) {
    return { status: "error", fieldErrors: { workspaceName: "Enter a name between 1 and 100 characters." } };
  }
  // Postgres accepts a few names (e.g. "Factory") that the app can't format.
  if (!isSupportedTimeZone(timezone)) {
    return { status: "error", fieldErrors: { timezone: "Choose a timezone from the list." } };
  }

  // Always the user's personal workspace; a tampered form cannot pick another.
  const { workspace } = await getPersonalWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name, timezone })
    .eq("id", workspace.id)
    .select("id");

  if (error) {
    // The database rejects names Postgres doesn't know (see validate_timezone).
    if (error.code === "23514" && error.message.includes("timezone")) {
      return { status: "error", fieldErrors: { timezone: "Choose a timezone from the list." } };
    }
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!data?.length) return { status: "error", message: GENERIC_ERROR };

  revalidatePath("/", "layout");
  return { status: "success", message: "Workspace saved." };
}
