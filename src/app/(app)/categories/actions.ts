"use server";

import { revalidatePath } from "next/cache";
import { logDbError, toUserMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getPersonalWorkspace } from "@/lib/workspace";

export type CategoryState = { status: "idle" | "error" | "success"; message?: string };

const DUPLICATE = "A category with that name already exists.";
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const UUID = /^[0-9a-f-]{36}$/i;

function validName(raw: FormDataEntryValue | null): string | null {
  const name = text(raw);
  return name.length >= 1 && name.length <= 100 ? name : null;
}

export async function addCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const { workspace } = await getPersonalWorkspace(); // never from the form
  const kind = text(formData.get("kind"));
  if (kind !== "income" && kind !== "expense") return { status: "error", message: "Choose income or expense." };
  const name = validName(formData.get("name"));
  if (!name) return { status: "error", message: "Enter a name up to 100 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ workspace_id: workspace.id, name, kind });
  if (error) {
    if (error.code !== "23505") logDbError("add category", error);
    return { status: "error", message: toUserMessage(error, { duplicate: DUPLICATE }) };
  }
  revalidatePath("/categories");
  return { status: "success" };
}

export async function renameCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const id = text(formData.get("id"));
  if (!UUID.test(id)) return { status: "error", message: "Not found." };
  const name = validName(formData.get("name"));
  if (!name) return { status: "error", message: "Enter a name up to 100 characters." };

  const { workspace } = await getPersonalWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("is_system", false)
    .select("id");
  if (error) {
    if (error.code !== "23505") logDbError("rename category", error);
    return { status: "error", message: toUserMessage(error, { duplicate: DUPLICATE }) };
  }
  if (!data?.length) return { status: "error", message: "Not found." };
  revalidatePath("/categories");
  return { status: "success", message: "Saved." };
}

export async function setCategoryArchived(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const id = text(formData.get("id"));
  if (!UUID.test(id)) return { status: "error", message: "Not found." };
  const archived = text(formData.get("archived")) === "true";

  const { workspace } = await getPersonalWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("is_system", false)
    .select("id");
  if (error) {
    logDbError("archive category", error);
    return { status: "error", message: toUserMessage(error) };
  }
  if (!data?.length) return { status: "error", message: "Not found." };
  revalidatePath("/categories");
  return { status: "success" };
}
