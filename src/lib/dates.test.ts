import { describe, expect, it } from "vitest";
import { formatInTimeZone, localMonthRange } from "./dates";

describe("formatInTimeZone", () => {
  it("shows the local date in the workspace timezone", () => {
    expect(formatInTimeZone("2026-10-31T15:30:00Z", "Asia/Seoul")).toContain("1 Nov 2026");
    expect(formatInTimeZone("2026-10-31T15:30:00Z", "UTC")).toContain("31 Oct 2026");
  });
});

describe("unformattable timezones", () => {
  it("fall back to UTC instead of throwing", () => {
    expect(formatInTimeZone("2026-10-31T15:30:00Z", "Factory")).toContain("31 Oct 2026");
    expect(localMonthRange("Factory", new Date("2026-10-31T15:30:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
});

describe("localMonthRange", () => {
  it("uses the month in the given timezone, not UTC", () => {
    // 15:30 UTC on 31 Oct is already 1 Nov in Seoul.
    const now = new Date("2026-10-31T15:30:00Z");
    expect(localMonthRange("Asia/Seoul", now)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(localMonthRange("UTC", now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("handles February in a leap year", () => {
    expect(localMonthRange("Asia/Seoul", new Date("2028-02-10T00:00:00Z"))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
