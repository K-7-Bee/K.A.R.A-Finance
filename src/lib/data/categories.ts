import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type CategoryKind = "income" | "expense";
export type Category = { id: string; name: string; kind: CategoryKind; isArchived: boolean };

type Row = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name" | "kind" | "is_archived">;

/** Income and expense categories. System (equity) categories are never returned. */
export async function listCategories(
  workspaceId: string,
  { includeArchived = true }: { includeArchived?: boolean } = {},
): Promise<Category[]> {
  const supabase = await createClient();
  let query = supabase
    .from("categories")
    .select("id, name, kind, is_archived")
    .eq("workspace_id", workspaceId)
    .eq("is_system", false)
    .in("kind", ["income", "expense"])
    .order("name");
  if (!includeArchived) query = query.eq("is_archived", false);

  const { data, error } = await query;
  if (error) throw new Error("Could not load categories.");
  return (data as Row[]).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as CategoryKind,
    isArchived: c.is_archived,
  }));
}
