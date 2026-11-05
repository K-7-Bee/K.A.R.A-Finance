import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNext("/transactions")).toBe("/transactions");
    expect(safeNext("/accounts?tab=all#top")).toBe("/accounts?tab=all#top");
  });

  it.each([
    ["//evil.com"],
    ["//evil.com/overview"],
    ["https://evil.com"],
    ["http://localhost:3000/overview"],
    ["/\\evil.com"],
    ["\\\\evil.com"],
    ["javascript:alert(1)"],
    ["overview"],
    [" /overview"],
    ["/%2F%2Fevil.com"],
    ["/\tevil"],
    ["/.//evil.com"],
    ["/..//evil.com"],
    ["/%2e//evil.com"],
    ["/a/..//evil.com"],
    ["/./%2F/evil.com"],
    [""],
    [null],
    [undefined],
  ])("falls back to /overview for %j", (input) => {
    expect(safeNext(input as string | null | undefined)).toBe("/overview");
  });
});
