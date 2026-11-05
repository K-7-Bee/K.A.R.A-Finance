import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, visibleNav } from "./navigation";

describe("navigation", () => {
  it("lists every CLAUDE.md section in order", () => {
    expect(NAV_SECTIONS.map((s) => s.label)).toEqual([
      "Overview", "Transactions", "Accounts", "Budgets", "Goals", "Analytics", "AI Assistant", "Business", "Settings",
    ]);
  });

  it("shows only built sections in Stage 1", () => {
    const nav = visibleNav(1);
    expect(nav.all.map((s) => s.label)).toEqual(["Overview", "Transactions", "Accounts", "Settings"]);
    expect(nav.bar.map((s) => s.label)).toEqual(["Overview", "Transactions", "Accounts"]);
    expect(nav.more.map((s) => s.label)).toEqual(["Settings"]);
  });

  it("follows CLAUDE.md's mobile bar once Goals and Analytics exist", () => {
    const nav = visibleNav(3);
    expect(nav.bar.map((s) => s.label)).toEqual(["Overview", "Transactions", "Goals", "Analytics"]);
    expect(nav.more.map((s) => s.label)).toContain("Accounts");
  });

  it("keeps the mobile bar to four items plus More", () => {
    for (const stage of [1, 2, 3, 4, 5, 6]) expect(visibleNav(stage).bar.length).toBeLessThanOrEqual(4);
  });
});
