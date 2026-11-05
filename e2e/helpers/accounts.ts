import { expect, type Page } from "@playwright/test";

export async function createAccount(
  page: Page,
  opts: { name: string; type?: string; currency?: string; amount?: string; date?: string },
) {
  await page.goto("/accounts/new");
  await page.getByLabel("Name").fill(opts.name);
  if (opts.type) await page.getByLabel("Type").selectOption({ label: opts.type });
  if (opts.currency) await page.getByLabel("Currency").selectOption(opts.currency);
  if (opts.amount !== undefined) {
    const label = opts.type === "Credit card" ? "Amount you owe now" : "Current balance";
    await page.getByLabel(label).fill(opts.amount);
  }
  if (opts.date) await page.getByLabel("Opening date").fill(opts.date);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

export const accountCard = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

export const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
