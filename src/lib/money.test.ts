import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./money";

describe("formatMoney", () => {
  it("formats KRW (no minor unit)", () => {
    expect(formatMoney(1234567, "KRW", 0)).toBe("₩1,234,567");
  });
  it("formats negative USD cents", () => {
    expect(formatMoney(-150, "USD", 2)).toBe("-$1.50");
  });
  it("formats zero and single cents exactly", () => {
    expect(formatMoney(0, "USD", 2)).toBe("$0.00");
    expect(formatMoney(1, "USD", 2)).toBe("$0.01");
  });
  it("is exact for large values where float maths would drift", () => {
    expect(formatMoney(900719925474099, "USD", 2)).toBe("$9,007,199,254,740.99");
  });
  it("rejects non-integer or unsafe input", () => {
    expect(() => formatMoney(1.5, "KRW", 0)).toThrow();
    expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 2, "KRW", 0)).toThrow();
  });
});

describe("parseMoneyInput", () => {
  it.each([
    ["1,000", 0, 1000],
    ["50000", 0, 50000],
    ["12.34", 2, 1234],
    ["12.3", 2, 1230],
    ["12", 2, 1200],
    [" 0.01 ", 2, 1],
    ["-200,000", 0, -200000],
    ["1,234,567.89", 2, 123456789],
  ])("parses %j with minor unit %i to %i", (text, minorUnit, expected) => {
    expect(parseMoneyInput(text, minorUnit)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["12.345", 2],
    ["12.5", 0],
    ["abc", 0],
    ["", 0],
    ["1e5", 0],
    ["1.2.3", 2],
    ["--5", 0],
    ["12,34", 2],
    ["1,0,0", 0],
    ["1,00", 0],
    [",100", 0],
    ["99999999999999999999", 0],
  ])("rejects %j with minor unit %i", (text, minorUnit) => {
    expect(parseMoneyInput(text, minorUnit).ok).toBe(false);
  });
});
