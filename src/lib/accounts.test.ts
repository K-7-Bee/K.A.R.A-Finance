import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, accountTypeLabel, fromSignedOpening, isLiability, toSignedOpening } from "./accounts";

describe("account types", () => {
  it("lists the six types with labels", () => {
    expect(ACCOUNT_TYPES.map((t) => t.label)).toEqual(["Bank", "Cash", "Debit card", "Credit card", "Savings", "Investment"]);
    expect(accountTypeLabel("debit_card")).toBe("Debit card");
  });
  it("treats only credit cards as liabilities", () => {
    expect(isLiability("credit_card")).toBe(true);
    expect(isLiability("bank")).toBe(false);
  });
});

describe("opening balance sign", () => {
  it("stores the amount owed on a credit card as negative", () => {
    expect(toSignedOpening("credit_card", 200000)).toEqual({ ok: true, value: -200000 });
    expect(fromSignedOpening("credit_card", -200000)).toBe(200000);
  });
  it("keeps other accounts as entered, including an overdraft", () => {
    expect(toSignedOpening("bank", 1000000)).toEqual({ ok: true, value: 1000000 });
    expect(toSignedOpening("bank", -5000)).toEqual({ ok: true, value: -5000 });
    expect(fromSignedOpening("bank", -5000)).toBe(-5000);
  });
  it("rejects a negative amount owed", () => {
    const r = toSignedOpening("credit_card", -100);
    expect(r.ok).toBe(false);
  });
  it("treats zero as zero for every type", () => {
    expect(toSignedOpening("credit_card", 0)).toEqual({ ok: true, value: 0 });
    expect(Object.is(fromSignedOpening("credit_card", 0), 0)).toBe(true);
  });
});
