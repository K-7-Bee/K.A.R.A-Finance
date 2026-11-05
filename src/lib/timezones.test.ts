import { describe, expect, it } from "vitest";
import { isSupportedTimeZone, timeZoneOptions } from "./timezones";

describe("timezones", () => {
  it("accepts IANA zones the app can format, including UTC", () => {
    expect(isSupportedTimeZone("Asia/Seoul")).toBe(true);
    expect(isSupportedTimeZone("UTC")).toBe(true);
  });
  it("rejects names Postgres knows but Intl cannot format", () => {
    expect(isSupportedTimeZone("Factory")).toBe(false);
    expect(isSupportedTimeZone("Mars/Olympus")).toBe(false);
    expect(isSupportedTimeZone("")).toBe(false);
  });
  it("offers UTC in the picker", () => {
    expect(timeZoneOptions()).toContain("UTC");
    expect(timeZoneOptions()).toContain("Asia/Seoul");
  });
});
