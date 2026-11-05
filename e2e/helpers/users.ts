import { expect, type Page } from "@playwright/test";
import { latestLinkFor } from "./mailpit";

export const PASSWORD = "GoodPassword123";

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

/** Sign up through the UI and confirm via the emailed link. Leaves the page signed in on /overview. */
export async function signUpAndConfirm(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const link = await latestLinkFor(email, "Confirm your KARA Finance account");
  await page.goto(link);
  await expect(page).toHaveURL(/\/overview$/);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signOut(page: Page) {
  // On mobile the sign-out button lives under More.
  const more = page.getByRole("button", { name: "More" });
  if (await more.isVisible()) await more.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

/** The form's own error message (Next.js's route announcer also has role="alert"). */
export const formAlert = (page: Page) => page.locator("form [role=alert]");
