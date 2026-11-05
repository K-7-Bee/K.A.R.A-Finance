import type { AccountType } from "@/lib/data/accounts";
import { formatMoney } from "@/lib/money";

/** Minor units -> editable text without a currency symbol, e.g. 150050, 2 -> "1,500.50". */
export function formatAmountInput(minor: number, minorUnit: number): string {
  const text = formatMoney(minor, "USD", minorUnit, "en-US");
  return text.replace("$", "");
}

/** Balance as people read it: credit card debt is "Owed ₩200,000"; other balances are signed. */
export function balanceText(minor: number, currency: string, minorUnit: number, type: AccountType): string {
  if (type === "credit_card") {
    if (minor < 0) return `Owed ${formatMoney(-minor, currency, minorUnit)}`;
    if (minor > 0) return `${formatMoney(minor, currency, minorUnit)} credit`;
  }
  return formatMoney(minor, currency, minorUnit);
}

/**
 * Net balance per currency over active accounts. Inputs are the per-account
 * balances from account_balances; sums use BigInt so they are exact, and
 * different currencies are never added together.
 */
export function netByCurrency(
  rows: { currency: string; balance: number; isArchived: boolean }[],
): { currency: string; net: number }[] {
  const sums = new Map<string, bigint>();
  for (const r of rows) {
    if (r.isArchived) continue;
    sums.set(r.currency, (sums.get(r.currency) ?? BigInt(0)) + BigInt(r.balance));
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, net]) => {
      if (net > BigInt(Number.MAX_SAFE_INTEGER) || net < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new RangeError(`Total for ${currency} is too large to display exactly`);
      }
      return { currency, net: Number(net) };
    });
}
