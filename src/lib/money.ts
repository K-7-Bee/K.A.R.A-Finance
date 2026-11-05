// Money is stored as integer minor units (KRW: won; USD: cents). These helpers
// convert to and from display text using integer (BigInt) arithmetic only, so
// no value is ever rounded by binary floating point.

import type { Result } from "@/lib/validation/auth";

function assertSafeInteger(minor: number) {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Not a safe integer amount: ${minor}`);
}

/** Exact decimal string for an integer amount, e.g. (-150, 2) -> "-1.50". */
function toDecimalString(minor: number, minorUnit: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = BigInt(Math.abs(minor));
  if (minorUnit === 0) return `${sign}${abs}`;
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(minorUnit, "0");
  return `${sign}${whole}.${frac}`;
}

export function formatMoney(minor: number, currency: string, minorUnit: number, locale = "en-US"): string {
  assertSafeInteger(minor);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  });
  // Intl formats decimal strings exactly (no conversion to float).
  return formatter.format(toDecimalString(minor, minorUnit) as unknown as number);
}

/** Parse user input like "12,345" or "12.34" into integer minor units. */
export function parseMoneyInput(text: string, minorUnit: number): Result<number> {
  // Commas are accepted only as thousands separators ("1,234,567"), so a
  // decimal comma like "12,34" is rejected rather than read as 1234.
  const match = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return { ok: false, error: "Enter an amount like 12,345 or 12.34." };

  const [, sign, grouped, frac = ""] = match;
  const whole = grouped.replace(/,/g, "");
  if (frac.length > minorUnit) {
    return {
      ok: false,
      error: minorUnit === 0 ? "This currency has no decimal places." : `Use at most ${minorUnit} decimal places.`,
    };
  }

  const scale = BigInt(10) ** BigInt(minorUnit);
  const value = BigInt(whole) * scale + BigInt(frac.padEnd(minorUnit, "0") || "0");
  const signed = sign === "-" ? -value : value;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    return { ok: false, error: "That amount is too large." };
  }
  return { ok: true, value: Number(signed) };
}
