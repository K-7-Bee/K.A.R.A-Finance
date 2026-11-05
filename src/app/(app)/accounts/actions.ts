"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAccountType, toSignedOpening } from "@/lib/accounts";
import { getAccount } from "@/lib/data/accounts";
import { findCurrency, getCurrencies } from "@/lib/data/currencies";
import { localDateInput } from "@/lib/dates";
import { logDbError, toUserMessage } from "@/lib/db-errors";
import { balanceText } from "@/lib/display";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getPersonalWorkspace } from "@/lib/workspace";

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function validName(raw: FormDataEntryValue | null): string | null {
  const name = text(raw).trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

function validDate(raw: FormDataEntryValue | null): string | null | undefined {
  const v = text(raw).trim();
  if (v === "") return null; // let the database default it
  if (!DATE_RE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

/** YYYY-MM-DD strings compare correctly as text. */
const isFutureDate = (date: string, timeZone: string) => date > localDateInput(new Date(), timeZone);

/** The account if it belongs to the signed-in user's personal workspace. */
async function ownAccount(id: FormDataEntryValue | null) {
  const { workspace } = await getPersonalWorkspace();
  const account = await getAccount(text(id));
  return account && account.workspaceId === workspace.id ? { account, workspace } : null;
}

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await getPersonalWorkspace(); // never taken from the form
  const currencies = await getCurrencies();
  const fieldErrors: Record<string, string> = {};

  const name = validName(formData.get("name"));
  if (!name) fieldErrors.name = "Enter a name up to 100 characters.";

  const type = formData.get("type");
  if (!isAccountType(type)) fieldErrors.type = "Choose an account type.";

  const currency = findCurrency(currencies, formData.get("currency"));
  if (!currency) fieldErrors.currency = "Choose a currency from the list.";

  let opening = 0;
  const amountText = text(formData.get("amount")).trim();
  if (currency && isAccountType(type) && amountText !== "") {
    const parsed = parseMoneyInput(amountText, currency.minorUnit);
    if (!parsed.ok) fieldErrors.amount = parsed.error;
    else {
      const signed = toSignedOpening(type, parsed.value);
      if (!signed.ok) fieldErrors.amount = signed.error;
      else opening = signed.value;
    }
  }

  const date = validDate(formData.get("date"));
  if (date === undefined) fieldErrors.date = "Enter a valid date.";
  else if (date && isFutureDate(date, workspace.timezone)) fieldErrors.date = "The opening date can't be in the future.";

  if (Object.keys(fieldErrors).length > 0 || !name || !isAccountType(type) || !currency || date === undefined) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_account", {
    p_workspace_id: workspace.id,
    p_name: name,
    p_type: type,
    p_currency: currency.code,
    p_opening_balance: opening,
    ...(date ? { p_opening_date: date } : {}),
  });
  if (error || !id) {
    logDbError("create_account", error);
    return { status: "error", message: toUserMessage(error) };
  }

  revalidatePath("/accounts");
  redirect(`/accounts/${id}`);
}

export async function renameAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownAccount(formData.get("accountId"));
  if (!own) return { status: "error", message: "Not found." };
  const name = validName(formData.get("name"));
  if (!name) return { status: "error", fieldErrors: { name: "Enter a name up to 100 characters." } };

  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").update({ name }).eq("id", own.account.id).select("id");
  if (error || !data?.length) {
    if (error) logDbError("rename account", error);
    return { status: "error", message: toUserMessage(error) };
  }
  revalidatePath("/accounts", "layout");
  return { status: "success", message: "Account renamed." };
}

export async function setAccountArchived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownAccount(formData.get("accountId"));
  if (!own) return { status: "error", message: "Not found." };
  const archived = text(formData.get("archived")) === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", own.account.id)
    .select("id");
  if (error || !data?.length) {
    if (error) logDbError("archive account", error);
    return { status: "error", message: toUserMessage(error) };
  }
  revalidatePath("/accounts", "layout");
  return { status: "success", message: archived ? "Account archived." : "Account restored." };
}

export async function setOpeningBalance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownAccount(formData.get("accountId"));
  if (!own) return { status: "error", message: "Not found." };
  const { account, workspace } = own;
  const currency = findCurrency(await getCurrencies(), account.currency);
  if (!currency) return { status: "error", message: "Not found." };

  const amountText = text(formData.get("amount")).trim();
  let signed = 0;
  if (amountText !== "") {
    const parsed = parseMoneyInput(amountText, currency.minorUnit);
    if (!parsed.ok) return { status: "error", fieldErrors: { amount: parsed.error } };
    const s = toSignedOpening(account.type, parsed.value);
    if (!s.ok) return { status: "error", fieldErrors: { amount: s.error } };
    signed = s.value;
  }
  const date = validDate(formData.get("date"));
  if (date === undefined) return { status: "error", fieldErrors: { date: "Enter a valid date." } };
  if (date && isFutureDate(date, workspace.timezone)) {
    return { status: "error", fieldErrors: { date: "The opening date can't be in the future." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_opening_balance", {
    p_account_id: account.id,
    p_amount: signed,
    ...(date ? { p_opening_date: date } : {}),
  });
  if (error) {
    logDbError("set_opening_balance", error);
    return { status: "error", message: toUserMessage(error) };
  }
  revalidatePath("/accounts", "layout");
  return { status: "success", message: signed === 0 ? "Opening balance removed." : "Opening balance saved." };
}

export async function reconcileAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const own = await ownAccount(formData.get("accountId"));
  if (!own) return { status: "error", message: "Not found." };
  const { account, workspace } = own;
  const currency = findCurrency(await getCurrencies(), account.currency);
  if (!currency) return { status: "error", message: "Not found." };

  const parsed = parseMoneyInput(text(formData.get("amount")), currency.minorUnit);
  if (!parsed.ok) return { status: "error", fieldErrors: { amount: parsed.error } };
  const actual = toSignedOpening(account.type, parsed.value);
  if (!actual.ok) return { status: "error", fieldErrors: { amount: actual.error } };

  const date = validDate(formData.get("asOf"));
  if (!date) return { status: "error", fieldErrors: { asOf: "Enter a valid date." } };
  const today = localDateInput(new Date(), workspace.timezone);
  if (date > today) return { status: "error", fieldErrors: { asOf: "Reconcile as of today or an earlier date." } };

  // The database turns the local date into an instant (today = now; a past day
  // = the end of that day) with the same timezone rules as every total.
  const supabase = await createClient();
  const { data: adjustmentId, error } = await supabase.rpc("reconcile_account_on_date", {
    p_account_id: account.id,
    p_actual_balance: actual.value,
    p_date: date,
  });
  if (error) {
    logDbError("reconcile_account", error);
    return { status: "error", message: toUserMessage(error) };
  }
  revalidatePath("/accounts", "layout");

  if (!adjustmentId) return { status: "success", message: "Balance already matches. Nothing changed." };

  // Report what the database recorded, not what the browser computed. The
  // adjustment is already saved, so a failed read-back still reports success.
  let adjustment: { amount: number } | null = null;
  let refreshed: Awaited<ReturnType<typeof getAccount>> = null;
  try {
    const [adjRes, acc] = await Promise.all([
      supabase.from("transactions").select("amount").eq("id", adjustmentId).single(),
      getAccount(account.id),
    ]);
    if (adjRes.error) logDbError("read adjustment", adjRes.error);
    adjustment = adjRes.data;
    refreshed = acc;
  } catch {
    logDbError("read account after reconcile", null);
  }
  if (!adjustment || !refreshed) return { status: "success", message: "Adjustment posted. Reload to see the new balance." };
  return {
    status: "success",
    message: `Adjustment of ${formatMoney(adjustment.amount, account.currency, currency.minorUnit)} posted. Balance is now ${balanceText(
      refreshed.balance,
      account.currency,
      currency.minorUnit,
      account.type,
    )}.`,
  };
}

