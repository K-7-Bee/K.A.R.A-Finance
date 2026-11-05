import { expect, test } from "@playwright/test";
import { clearInbox, latestLinkFor } from "./helpers/mailpit";
import { PASSWORD, formAlert, signIn, signOut, signUpAndConfirm, uniqueEmail } from "./helpers/users";

test.describe("auth", () => {
  test("signed-out visitors are sent to sign-in and returned afterwards", async ({ page }) => {
    const email = uniqueEmail("return");
    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/overview");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Foverview$/);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("a confirmation link works once; reusing it shows the error page", async ({ page, browser }) => {
    const email = uniqueEmail("reuse");
    await signUpAndConfirm(page, email);
    const link = await latestLinkFor(email, "Confirm your KARA Finance account");
    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto(link);
    await expect(other).toHaveURL(/\/auth\/error$/);
    await fresh.close();
  });

  test("sign up, confirm by email, land on the Overview, sign out", async ({ page }) => {
    const email = uniqueEmail("signup");
    await signUpAndConfirm(page, email);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await signOut(page);
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("cannot sign in before confirming the email", async ({ page }) => {
    const email = uniqueEmail("unconfirmed");
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    await signIn(page, email);
    await expect(formAlert(page)).toContainText("confirm your email");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("wrong password and unknown email give the same message", async ({ page }) => {
    const email = uniqueEmail("generic");
    await signUpAndConfirm(page, email);
    await signOut(page);

    await signIn(page, email, "WrongPassword999");
    const wrongPassword = await formAlert(page).textContent();

    await signIn(page, uniqueEmail("nobody"));
    const unknownEmail = await formAlert(page).textContent();

    expect(wrongPassword).toContain("Email or password is incorrect");
    expect(unknownEmail).toBe(wrongPassword);
  });

  test("signing up with a registered email looks the same as a new sign-up", async ({ page }) => {
    const email = uniqueEmail("dupe");
    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("sign-in honours a safe next path and ignores an unsafe one", async ({ page }) => {
    const email = uniqueEmail("next");
    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-in?next=%2Fsettings");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await signOut(page);

    for (const unsafe of ["%2F%2Fevil.com", "%2F.%2F%2Fevil.com"]) {
      await page.goto(`/sign-in?next=${unsafe}`);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/localhost:3000\/overview$/);
      await signOut(page);
    }
  });

  test("the email confirm link never redirects off-site", async ({ page }) => {
    const email = uniqueEmail("confirm-next");
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    const link = new URL(await latestLinkFor(email, "Confirm your KARA Finance account"));
    link.searchParams.set("next", "/.//evil.com");
    await page.goto(link.toString());
    await expect(page).toHaveURL(/localhost:3000\/overview$/);
  });

  test("password reset: new password works, old one does not", async ({ page }) => {
    const email = uniqueEmail("reset");
    const newPassword = "BrandNewPass456";
    await signUpAndConfirm(page, email);
    await signOut(page);
    await clearInbox(email);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists")).toBeVisible();

    const link = await latestLinkFor(email, "Reset your KARA Finance password");
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("Password updated")).toBeVisible();

    await signOut(page);
    await signIn(page, email, PASSWORD);
    await expect(formAlert(page)).toContainText("Email or password is incorrect");
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/overview$/);
  });

  test("forgot-password gives the same answer for unknown emails", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(uniqueEmail("ghost"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists")).toBeVisible();
  });

  test("two users each see only their own workspace", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pageA = await a.newPage();
    const pageB = await b.newPage();

    const emailA = uniqueEmail("iso-a");
    await signUpAndConfirm(pageA, emailA);
    await pageA.goto("/settings");
    await pageA.getByLabel("Workspace name").fill("Alpha household");
    await pageA.getByRole("button", { name: "Save workspace" }).click();
    await expect(pageA.getByText("Workspace saved")).toBeVisible();

    const emailB = uniqueEmail("iso-b");
    await signUpAndConfirm(pageB, emailB);
    await pageB.goto("/settings");
    await expect(pageB.getByLabel("Email")).toHaveValue(emailB);
    await expect(pageB.getByLabel("Workspace name")).toHaveValue("Personal");
    await expect(pageB.locator("body")).not.toContainText("Alpha household");
    await expect(pageB.locator("body")).not.toContainText(emailA);

    // B renames their own workspace; A's name is untouched.
    await pageB.getByLabel("Workspace name").fill("Beta flat");
    await pageB.getByRole("button", { name: "Save workspace" }).click();
    await expect(pageB.getByText("Workspace saved")).toBeVisible();
    await pageA.reload();
    await expect(pageA.getByLabel("Workspace name")).toHaveValue("Alpha household");

    await a.close();
    await b.close();
  });
});
