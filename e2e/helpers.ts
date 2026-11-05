import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const admin = {
  username: process.env.ADMIN_USERNAME ?? "admin",
  password: process.env.ADMIN_PASSWORD ?? "admin12345",
};

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Collects console errors and unhandled rejections; assert empty at the end. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // GET /api/admin/users/{u}/ban answers 404 when there is no ban (API contract); Chrome logs it.
    if (m.text().includes("404") && /\/api\/admin\/users\/[^/]+\/ban$/.test(m.location().url)) return;
    errors.push(`${m.text()} ${m.location().url}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function uiLogin(page: Page) {
  await page.addInitScript(() => localStorage.setItem("admin.locale", "en"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Username or email").fill(admin.username);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

export const TOKEN_FILE = "e2e/.auth/token.json";

/** Token from global setup ({token, expiresAt}). */
export const session = (): { token: string; expiresAt: string } => JSON.parse(readFileSync(TOKEN_FILE, "utf8"));

/** Opens the app already signed in (same storage the app uses), skipping the login form. */
export async function signedIn(page: Page, path = "/") {
  const s = session();
  await page.addInitScript((v) => {
    localStorage.setItem("admin.locale", "en");
    if (!sessionStorage.getItem("admin.session")) sessionStorage.setItem("admin.session", v);
  }, JSON.stringify(s));
  await page.goto(path);
}
