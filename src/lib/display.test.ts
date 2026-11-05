import { describe, expect, it } from "vitest";
import { balanceText, formatAmountInput, netByCurrency } from "./display";
import { localDateInput } from "./dates";

describe("formatAmountInput", () => {
  it("formats minor units as editable text without a symbol", () => {
    expect(formatAmountInput(1200000, 0)).toBe("1,200,000");
    expect(formatAmountInput(150050, 2)).toBe("1,500.50");
    expect(formatAmountInput(-5000, 0)).toBe("-5,000");
    expect(formatAmountInput(0, 2)).toBe("0.00");
  });
});

describe("balanceText", () => {
  it("shows credit card debt as owed", () => {
    expect(balanceText(-200000, "KRW", 0, "credit_card")).toBe("Owed ₩200,000");
    expect(balanceText(5000, "KRW", 0, "credit_card")).toBe("₩5,000 credit");
    expect(balanceText(0, "KRW", 0, "credit_card")).toBe("₩0");
  });
  it("shows other balances signed", () => {
    expect(balanceText(-30000, "KRW", 0, "bank")).toBe("-₩30,000");
    expect(balanceText(150050, "USD", 2, "savings")).toBe("$1,500.50");
  });
});

describe("netByCurrency", () => {
  it("sums per currency, excludes archived, never mixes currencies", () => {
    const rows = [
      { currency: "KRW", balance: 1000000, isArchived: false },
      { currency: "KRW", balance: -200000, isArchived: false },
      { currency: "USD", balance: 150050, isArchived: false },
      { currency: "KRW", balance: 999, isArchived: true },
    ];
    expect(netByCurrency(rows)).toEqual([
      { currency: "KRW", net: 800000 },
      { currency: "USD", net: 150050 },
    ]);
  });
  it("is exact beyond float precision for large sums", () => {
    const rows = [
      { currency: "KRW", balance: 900000000000000, isArchived: false },
      { currency: "KRW", balance: 1, isArchived: false },
    ];
    expect(netByCurrency(rows)).toEqual([{ currency: "KRW", net: 900000000000001 }]);
  });
});

describe("workspace-local dates", () => {
  it("gives the local calendar date for an instant", () => {
    expect(localDateInput("2026-10-31T15:30:00Z", "Asia/Seoul")).toBe("2026-11-01");
    expect(localDateInput("2026-10-31T15:30:00Z", "UTC")).toBe("2026-10-31");
  });
});
