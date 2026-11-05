// All account reads go through here. Balances always come from the
// account_balances SQL function, never from summing rows in TypeScript (GOV-1).
// Queries run with the user's session, so RLS decides what is visible.

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type AccountType = Database["public"]["Enums"]["account_type"];

export type AccountSummary = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  isArchived: boolean;
  balance: number; // minor units
};

export type AccountDetail = AccountSummary & {
  workspaceId: string;
  opening: { transactionId: string; amount: number; occurredAt: string } | null;
};

async function balances(workspaceId: string): Promise<AccountSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("account_balances", { p_workspace_id: workspaceId });
  if (error) throw new Error("Could not load account balances.");
  return data.map((r) => ({
    id: r.account_id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    isArchived: r.is_archived,
    balance: r.balance,
  }));
}

export async function listAccounts(
  workspaceId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<AccountSummary[]> {
  const all = await balances(workspaceId);
  return includeArchived ? all : all.filter((a) => !a.isArchived);
}

/** One account with its balance and posted opening balance, or null if it isn't visible to this user. */
export async function getAccount(accountId: string): Promise<AccountDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return null;
  const supabase = await createClient();

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error("Could not load the account.");
  if (!account) return null;

  const summary = (await balances(account.workspace_id)).find((a) => a.id === accountId);
  if (!summary) return null;

  const { data: opening, error: openingError } = await supabase
    .from("transactions")
    .select("id, amount, occurred_at")
    .eq("account_id", accountId)
    .eq("type", "opening_balance")
    .eq("status", "posted")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (openingError) throw new Error("Could not load the opening balance.");

  return {
    ...summary,
    workspaceId: account.workspace_id,
    opening: opening ? { transactionId: opening.id, amount: opening.amount, occurredAt: opening.occurred_at } : null,
  };
}
