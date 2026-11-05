import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath } from "./routes";

describe("route classification", () => {
  it.each(["/sign-in", "/sign-up", "/forgot-password", "/auth/confirm", "/auth/error"])(
    "%s is public",
    (path) => expect(isPublicPath(path)).toBe(true),
  );

  it.each(["/", "/overview", "/transactions", "/settings", "/reset-password", "/sign-in-anything", "/auth"])(
    "%s is protected",
    (path) => expect(isPublicPath(path)).toBe(false),
  );

  it("treats only sign-in and sign-up as pages a signed-in user is bounced from", () => {
    expect(isAuthPage("/sign-in")).toBe(true);
    expect(isAuthPage("/sign-up")).toBe(true);
    expect(isAuthPage("/forgot-password")).toBe(false);
    expect(isAuthPage("/auth/confirm")).toBe(false);
  });
});
