import { expect, test } from "@playwright/test";
import { accountCard, createAccount, noHorizontalScroll } from "./helpers/accounts";
import { signUpAndConfirm, uniqueEmail } from "./helpers/users";

test.describe("accounts", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("acct"));
  });

  test("empty state, then accounts in two currencies with separate totals", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page.getByText("No accounts yet")).toBeVisible();

    await createAccount(page, { name: "Bank", amount: "1,000,000" });
    await expect(page.getByRole("heading", { name: "Bank" })).toBeVisible();
    await expect(page.getByTestId("account-balance")).toHaveText("₩1,000,000");

    await createAccount(page, { name: "Card", type: "Credit card", amount: "200,000" });
    await createAccount(page, { name: "Dollars", currency: "USD", amount: "1,500.50" });

    await page.goto("/accounts");
    await expect(accountCard(page, "Bank")).toContainText("₩1,000,000");
    await expect(accountCard(page, "Card")).toContainText("Owed ₩200,000");
    await expect(accountCard(page, "Dollars")).toContainText("$1,500.50");

    // Never summed across currencies; liabilities included in the net figure.
    await expect(page.getByTestId("total-KRW")).toContainText("₩800,000");
    await expect(page.getByTestId("total-USD")).toContainText("$1,500.50");
    await noHorizontalScroll(page);
  });

  test("amounts with too many decimals are rejected before saving", async ({ page }) => {
    await page.goto("/accounts/new");
    await page.getByLabel("Name").fill("Bad KRW");
    await page.getByLabel("Current balance").fill("12.5");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("This currency has no decimal places.")).toBeVisible();

    await page.getByLabel("Currency").selectOption("USD");
    await page.getByLabel("Current balance").fill("12.345");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at most 2 decimal places.")).toBeVisible();

    await page.goto("/accounts");
    await expect(page.getByText("No accounts yet")).toBeVisible();
  });

  test("change and remove the opening balance", async ({ page }) => {
    await createAccount(page, { name: "Bank", amount: "1,000,000", date: "2026-01-01" });
    await page.getByLabel("Opening balance").fill("1,200,000");
    await page.getByRole("button", { name: "Save opening balance" }).click();
    await expect(page.getByText("Opening balance saved")).toBeVisible();
    await expect(page.getByTestId("account-balance")).toHaveText("₩1,200,000");

    await page.getByLabel("Opening balance").fill("0");
    await page.getByRole("button", { name: "Save opening balance" }).click();
    await expect(page.getByTestId("account-balance")).toHaveText("₩0");
  });

  test("credit card opening balance is entered and shown as the amount owed", async ({ page }) => {
    await createAccount(page, { name: "Card", type: "Credit card", amount: "200,000" });
    await expect(page.getByTestId("account-balance")).toHaveText("Owed ₩200,000");
    await expect(page.getByLabel("Amount owed at opening")).toHaveValue("200,000");
  });

  test("reconcile posts the exact difference, then reports a match", async ({ page }) => {
    await createAccount(page, { name: "Bank", amount: "830,000" });
    await page.getByRole("link", { name: "Reconcile" }).click();
    await expect(page.getByText("Balance in KARA: ₩830,000")).toBeVisible();

    await page.getByLabel("Actual balance").fill("800,000");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByRole("status")).toContainText("Adjustment of -₩30,000 posted. Balance is now ₩800,000.");

    await page.getByLabel("Actual balance").fill("800,000");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByRole("status")).toContainText("Balance already matches. Nothing changed.");
    await noHorizontalScroll(page);
  });

  test("future dates are rejected; a past-dated reconcile applies now", async ({ page }) => {
    await createAccount(page, { name: "Bank", amount: "500,000", date: "2026-01-01" });
    await page.getByLabel("Opening date").fill("2099-01-01");
    await page.getByRole("button", { name: "Save opening balance" }).click();
    await expect(page.getByText("The opening date can't be in the future.")).toBeVisible();

    await page.getByRole("link", { name: "Reconcile" }).click();
    await page.getByLabel("Actual balance").fill("450,000");
    await page.getByLabel("As of").fill("2099-01-01");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByText("Reconcile as of today or an earlier date.")).toBeVisible();

    await page.getByLabel("Actual balance").fill("450,000");
    await page.getByLabel("As of").fill("2026-02-01");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByRole("status")).toContainText("Adjustment of -₩50,000 posted. Balance is now ₩450,000.");
  });

  test("month-end reconcile applies now; dates before the opening are rejected", async ({ page }) => {
    await createAccount(page, { name: "Bank", amount: "500,000", date: "2026-01-01" });
    await page.getByRole("link", { name: "Reconcile" }).click();

    await page.getByLabel("Actual balance").fill("480,000");
    await page.getByLabel("As of").fill("2025-12-31");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByText("before the opening date")).toBeVisible();

    await page.getByLabel("Actual balance").fill("480,000");
    await page.getByLabel("As of").fill("2026-01-31");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByRole("status")).toContainText("Adjustment of -₩20,000 posted. Balance is now ₩480,000.");
    await page.goto("/accounts");
    await expect(page.getByTestId("total-KRW")).toContainText("₩480,000");
  });

  test("credit card: edit amount owed and reconcile against the statement", async ({ page }) => {
    await createAccount(page, { name: "Card", type: "Credit card", amount: "200,000" });
    await page.getByLabel("Amount owed at opening").fill("250,000");
    await page.getByRole("button", { name: "Save opening balance" }).click();
    await expect(page.getByTestId("account-balance")).toHaveText("Owed ₩250,000");

    await page.getByRole("link", { name: "Reconcile" }).click();
    await page.getByLabel("Amount you owe").fill("260,000");
    await page.getByRole("button", { name: "Reconcile" }).click();
    await expect(page.getByRole("status")).toContainText("Adjustment of -₩10,000 posted. Balance is now Owed ₩260,000.");
  });

  test("a tampered currency is rejected", async ({ page }) => {
    await page.goto("/accounts/new");
    await page.getByLabel("Name").fill("Fake");
    await page.getByLabel("Currency").evaluate((el: HTMLSelectElement) => {
      const o = document.createElement("option");
      o.value = "XXX";
      o.textContent = "XXX";
      el.appendChild(o);
      el.value = "XXX";
    });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Choose a currency from the list.")).toBeVisible();
  });

  test("rename, archive and unarchive", async ({ page }) => {
    const id = await createAccount(page, { name: "Wallet", type: "Cash", amount: "50,000" });
    await page.getByLabel("Account name").fill("Pocket money");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("heading", { name: "Pocket money" })).toBeVisible();

    await page.getByRole("button", { name: "Archive account" }).click();
    await page.getByRole("button", { name: "Yes, archive" }).click();
    await expect(page.getByText("This account is archived")).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconcile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save opening balance" })).toHaveCount(0);

    await page.goto(`/accounts/${id}/reconcile`);
    await expect(page.getByText("Unarchive it to reconcile")).toBeVisible();

    await page.goto("/accounts");
    await expect(accountCard(page, "Pocket money")).toHaveCount(0);
    await page.getByRole("link", { name: "Show archived" }).click();
    await expect(accountCard(page, "Pocket money")).toContainText("Archived");

    await page.goto(`/accounts/${id}`);
    await page.getByRole("button", { name: "Unarchive account" }).click();
    await expect(page.getByText("This account is archived")).toHaveCount(0);
    await noHorizontalScroll(page);
  });

  test("another user's account is not found", async ({ page, browser }) => {
    const id = await createAccount(page, { name: "Private", amount: "10,000" });
    const other = await browser.newContext();
    const pageB = await other.newPage();
    await signUpAndConfirm(pageB, uniqueEmail("acct-b"));
    const res = await pageB.goto(`/accounts/${id}`);
    expect(res?.status()).toBe(404);
    await expect(pageB.locator("body")).not.toContainText("Private");
    await pageB.goto(`/accounts/${id}/reconcile`);
    await expect(pageB.locator("body")).not.toContainText("Private");
    await other.close();
  });
});
