import type { Result } from "@/lib/validation/auth";
import type { AccountType } from "@/lib/data/accounts";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit card" },
  { value: "credit_card", label: "Credit card" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
];

export const isAccountType = (v: unknown): v is AccountType => ACCOUNT_TYPES.some((t) => t.value === v);

export const accountTypeLabel = (type: AccountType) => ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;

/** Accounts whose balance is money owed. Users enter what they owe as a positive number. */
export const isLiability = (type: AccountType) => type === "credit_card";

/** Form entry -> signed ledger amount (credit card: amount owed becomes negative). */
export function toSignedOpening(type: AccountType, entered: number): Result<number> {
  if (!isLiability(type)) return { ok: true, value: entered };
  if (entered < 0) return { ok: false, error: "Enter the amount you owe as a positive number." };
  return { ok: true, value: entered === 0 ? 0 : -entered };
}

/** Signed ledger amount -> what the form shows. */
export function fromSignedOpening(type: AccountType, stored: number): number {
  return isLiability(type) && stored !== 0 ? -stored : stored;
}
