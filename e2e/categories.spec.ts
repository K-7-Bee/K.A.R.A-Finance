import { expect, test } from "@playwright/test";
import { signUpAndConfirm, uniqueEmail } from "./helpers/users";

test.describe("categories", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("cat"));
  });

  test("navigation reaches Categories", async ({ page }, testInfo) => {
    if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("link", { name: "Categories" }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });

  test("lists defaults, hides system categories", async ({ page }) => {
    await page.goto("/categories");
    const income = page.getByRole("region", { name: "Income" });
    const expense = page.getByRole("region", { name: "Expense" });
    await expect(income.getByLabel("Name for Salary")).toBeVisible();
    await expect(expense.getByLabel("Name for Food")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Opening balance");
    await expect(page.locator("body")).not.toContainText("Balance adjustment");
  });

  test("add, reject duplicate, rename, archive and unarchive", async ({ page }) => {
    await page.goto("/categories");
    const expense = page.getByRole("region", { name: "Expense" });

    await expense.getByLabel("New expense category").fill("Pets");
    await expense.getByRole("button", { name: "Add" }).click();
    await expect(expense.getByLabel("Name for Pets")).toBeVisible();

    await expense.getByLabel("New expense category").fill("Pets");
    await expense.getByRole("button", { name: "Add" }).click();
    await expect(expense.getByText("A category with that name already exists.")).toBeVisible();

    const row = expense.getByRole("listitem").filter({ has: page.getByLabel("Name for Pets") });
    await row.getByLabel("Name for Pets").fill("Pet care");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(expense.getByLabel("Name for Pet care")).toBeVisible();

    const renamed = expense.getByRole("listitem").filter({ has: page.getByLabel("Name for Pet care") });
    await renamed.getByRole("button", { name: "Archive" }).click();
    const archived = page.getByRole("region", { name: "Archived" });
    await expect(archived.getByText("Pet care")).toBeVisible();
    await expect(expense.getByLabel("Name for Pet care")).toHaveCount(0);

    await archived.getByRole("listitem").filter({ hasText: "Pet care" }).getByRole("button", { name: "Unarchive" }).click();
    await expect(expense.getByLabel("Name for Pet care")).toBeVisible();
  });
});
