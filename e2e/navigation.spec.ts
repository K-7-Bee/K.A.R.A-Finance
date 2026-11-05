import { expect, test } from "@playwright/test";
import { signUpAndConfirm, uniqueEmail } from "./helpers/users";

test.describe("app shell", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("nav"));
  });

  test("shows Stage 1 sections only, with no horizontal scroll", async ({ page }, testInfo) => {
    const nav = page.getByRole("navigation", { name: "Main" });
    const isMobile = testInfo.project.name === "mobile";

    if (isMobile) {
      for (const label of ["Overview", "Transactions", "Accounts"]) {
        await expect(nav.getByRole("link", { name: label })).toBeVisible();
      }
      await nav.getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("link", { name: "Settings" })).toBeHidden();
    } else {
      for (const label of ["Overview", "Transactions", "Accounts", "Settings"]) {
        await expect(nav.getByRole("link", { name: label })).toBeVisible();
      }
    }

    for (const later of ["Budgets", "Goals", "Analytics", "AI Assistant", "Business"]) {
      await expect(page.getByRole("link", { name: later })).toHaveCount(0);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("marks the current page and navigates between sections", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(nav.getByRole("link", { name: "Transactions" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  });

  test("settings: display name and workspace timezone persist", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByLabel("Base currency")).toHaveValue("KRW");

    await page.getByLabel("Display name").fill("Ji-woo");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();

    await page.getByLabel("Workspace name").fill("Home budget");
    await page.getByLabel("Timezone").selectOption("Europe/London");
    await page.getByRole("button", { name: "Save workspace" }).click();
    await expect(page.getByText("Workspace saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Ji-woo");
    await expect(page.getByLabel("Workspace name")).toHaveValue("Home budget");
    await expect(page.getByLabel("Timezone")).toHaveValue("Europe/London");

    await page.getByLabel("Timezone").selectOption("UTC");
    await page.getByRole("button", { name: "Save workspace" }).click();
    await expect(page.getByText("Workspace saved")).toBeVisible();
  });

  for (const bogus of ["Mars/Olympus", "Factory"]) test(`settings rejects tampered timezone ${bogus}`, async ({ page }) => {
    await page.goto("/settings");
    // Simulate a tampered request: add a bogus option and submit it.
    await page.getByLabel("Timezone").evaluate((el: HTMLSelectElement, tz: string) => {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz;
      el.appendChild(opt);
      el.value = tz;
    }, bogus);
    await page.getByRole("button", { name: "Save workspace" }).click();
    await expect(page.getByText("Choose a timezone from the list")).toBeVisible();
  });
});
