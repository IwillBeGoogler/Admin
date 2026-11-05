import { expect, test } from "@playwright/test";
import { signedIn, watchConsole } from "./helpers";

test("mobile: drawer navigation, dark mode, language switch", async ({ page }) => {
  const errors = watchConsole(page);
  await signedIn(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: "O'zbekcha" }).click();
  await expect(page.getByRole("heading", { name: "Shikoyatlar" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  expect(errors).toEqual([]);
});
