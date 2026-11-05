import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Workspace = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
};

export type CurrentUser = { id: string; email: string };

/**
 * The signed-in user and their personal workspace, read with the user's own
 * session so RLS applies. Cached per request.
 */
export const getPersonalWorkspace = cache(async (): Promise<{ user: CurrentUser; workspace: Workspace }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, base_currency, timezone")
    .eq("kind", "personal")
    .eq("owner_id", user.id) // explicit, not only via RLS: shared workspaces may be readable later
    .maybeSingle();

  if (error) throw new Error("Could not load your workspace.");
  if (!data) throw new Error("Your personal workspace is missing. Please contact support.");

  return { user: { id: user.id, email: user.email ?? "" }, workspace: data };
});
