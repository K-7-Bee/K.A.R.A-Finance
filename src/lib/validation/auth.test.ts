import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword } from "./auth";

describe("validateEmail", () => {
  it("accepts a normal address and trims it", () => {
    expect(validateEmail("  ana@example.com ")).toEqual({ ok: true, value: "ana@example.com" });
  });
  it.each(["", "ana", "ana@", "@example.com", "ana @example.com", "a".repeat(250) + "@x.co"])(
    "rejects %j",
    (input) => expect(validateEmail(input).ok).toBe(false),
  );
});

// Mirrors supabase/config.toml: minimum_password_length = 10,
// password_requirements = "lower_upper_letters_digits".
describe("validatePassword", () => {
  it("accepts 10+ characters with lower, upper and a digit", () => {
    expect(validatePassword("GoodPassword123").ok).toBe(true);
  });
  it.each([
    ["Short1Aa", "at least 10"],
    ["alllowercase123", "uppercase"],
    ["ALLUPPERCASE123", "lowercase"],
    ["NoDigitsAtAllHere", "number"],
  ])("rejects %j (%s)", (input, reason) => {
    const result = validatePassword(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(reason);
  });
  it("rejects passwords over 72 characters (bcrypt limit)", () => {
    expect(validatePassword("Aa1" + "x".repeat(70)).ok).toBe(false);
  });
});
