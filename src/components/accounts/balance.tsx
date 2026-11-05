import type { AccountType } from "@/lib/data/accounts";
import { balanceText } from "@/lib/display";
import { negativeText } from "@/components/ui/styles";

/** A balance as text, tinted when negative (the minus sign or "Owed" carries the meaning too). */
export function Balance({
  minor, currency, minorUnit, type, className = "", testId,
}: { minor: number; currency: string; minorUnit: number; type: AccountType; className?: string; testId?: string }) {
  return (
    <span data-testid={testId} className={`tabular-nums ${minor < 0 ? negativeText : "text-midnight"} ${className}`}>
      {balanceText(minor, currency, minorUnit, type)}
    </span>
  );
}
