import { expect, test } from "@playwright/test";
import { session, signedIn, uid, uiLogin, watchConsole } from "./helpers";

test.describe
  .serial("admin panel against the real API", () => {
    let token = "";
    const suffix = uid();

    test.beforeAll(() => {
      token = session().token;
    });

    test("login → stats → create & delete post → categories", async ({ page }) => {
      const errors = watchConsole(page);
      await uiLogin(page);

      // stats cards render real numbers
      const posts = page.getByRole("region", { name: "Platform overview" }).getByText("Posts", { exact: true });
      await expect(posts).toBeVisible();
      await expect(page.getByText(/Likes \/ post: /)).toBeVisible();

      // category create
      await page.getByRole("link", { name: "Categories" }).first().click();
      const cat = `E2E ${suffix}`;
      await page.getByLabel("New category").fill(cat);
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("link", { name: cat })).toBeVisible();

      // create a published post in that category
      await page.getByRole("link", { name: "Posts" }).first().click();
      await page.getByRole("link", { name: "New post" }).click();
      const title = `E2E post ${suffix}`;
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Status", { exact: true }).selectOption("published");
      await page.getByLabel("Category", { exact: true }).selectOption({ label: cat });
      await page.getByLabel("Tags (comma separated)").fill("e2e");
      await page.getByLabel("Body (Markdown)").fill("Created by Playwright.");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible();
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);

      // edit → creates a revision
      await page.getByLabel("Title", { exact: true }).fill(`${title} v2`);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("button", { name: new RegExp(`Version 1 · ${title}`) })).toBeVisible();

      // list → filter by category → delete
      await page.getByRole("link", { name: "Back" }).click();
      await page.getByLabel("Category", { exact: true }).selectOption({ label: cat });
      await expect(page.getByRole("link", { name: `${title} v2` }).first()).toBeVisible();
      await page.getByRole("button", { name: `Delete: ${title} v2` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText("No results for current filters")).toBeVisible();

      // delete category
      await page.getByRole("link", { name: "Categories" }).first().click();
      await page.getByRole("button", { name: `Delete: ${cat}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(page.getByRole("link", { name: cat })).toHaveCount(0);
      const left = await page.request.get("/api/categories");
      expect(JSON.stringify(await left.json())).not.toContain(cat);

      expect(errors).toEqual([]);
    });

    test("reports: resolve with content removal", async ({ page, request }) => {
      const errors = watchConsole(page);
      const auth = { Authorization: `Bearer ${token}` };
      const created = await request.post("/api/posts", {
        headers: auth,
        data: { title: `Reported ${suffix}`, body: "spam spam", status: "published" },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const postId = ((await created.json()) as { data: { id: number } }).data.id;
      // The API refuses reports on your own content: report as a fresh account.
      const reporter = `rep_${suffix}`.slice(0, 32);
      const reg = await request.post("/api/auth/register", {
        data: { username: reporter, email: `${reporter}@example.org`, password: "e2e-password-123" },
      });
      expect(reg.ok(), await reg.text()).toBeTruthy();
      const reporterToken = ((await reg.json()) as { data: { token: string } }).data.token;
      const rep = await request.post("/api/reports", {
        headers: { Authorization: `Bearer ${reporterToken}` },
        data: { target_type: "post", target_id: postId, reason: "spam", note: `e2e ${suffix}` },
      });
      expect(rep.ok(), await rep.text()).toBeTruthy();
      const reportId = ((await rep.json()) as { data: { id: number } }).data.id;

      await signedIn(page);
      await page.getByRole("link", { name: "Reports" }).first().click();
      await page.getByRole("button", { name: `Resolve #${reportId}` }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Also remove the reported content").check();
      await dialog.getByRole("button", { name: "Resolve" }).click();
      await expect(page.getByRole("button", { name: `Resolve #${reportId}` })).toHaveCount(0);

      await page.getByRole("button", { name: "Resolved" }).click();
      await expect(page.getByRole("button", { name: "Resolved" })).toHaveAttribute("aria-pressed", "true");
      const gone = await request.get(`/api/posts/${postId}`, { headers: auth });
      expect(gone.status()).toBe(404);
      expect(errors).toEqual([]);
    });

    test("users: search, suspend, see in bans, unban", async ({ page, request }) => {
      const errors = watchConsole(page);
      const username = `e2e_${suffix}`.slice(0, 32);
      const reg = await request.post("/api/auth/register", {
        data: { username, email: `${username}@example.org`, password: "e2e-password-123" },
      });
      expect(reg.ok(), await reg.text()).toBeTruthy();

      await signedIn(page);
      await page.getByRole("link", { name: "Users" }).first().click();
      await page.getByRole("searchbox").fill(username);
      await expect(page.getByText(`@${username}`)).toBeVisible();
      await page.getByRole("button", { name: `Ban / suspend: @${username}` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("No active sanction")).toBeVisible();
      const until = new Date(Date.now() + 2 * 24 * 3600 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      await dialog
        .getByLabel("Suspended until")
        .fill(`${until.getFullYear()}-${pad(until.getMonth() + 1)}-${pad(until.getDate())}T12:00`);
      await dialog.getByLabel("Reason").fill("e2e suspension");
      await dialog.getByRole("button", { name: "Ban / suspend" }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole("link", { name: "Bans" }).first().click();
      const row = page.getByRole("row", { name: new RegExp(`@${username}`) });
      await expect(row).toContainText("Suspended");
      await expect(row).toContainText("e2e suspension");
      await row.getByRole("button", { name: `Lift ban: @${username}` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Lift sanction" }).click();
      // the dialog hides the page from the a11y tree, so wait for the result before asserting rows
      await expect(page.getByText(`Sanction lifted for @${username}`)).toBeVisible();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(page.getByRole("row", { name: new RegExp(`@${username}`) })).toHaveCount(0);

      const ban = await request.get(`/api/admin/users/${username}/ban`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(ban.status()).toBe(404);
      expect(errors).toEqual([]);
    });

    test("access pages load (roles, sessions, audit)", async ({ page }) => {
      const errors = watchConsole(page);
      await signedIn(page);
      await page.getByRole("link", { name: "Roles" }).first().click();
      await expect(page.getByText("super_admin", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Sessions" }).first().click();
      await expect(page.getByText("This session")).toBeVisible();
      await page.getByRole("link", { name: "Audit log" }).first().click();
      await expect(page.getByText("auth.login").first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
