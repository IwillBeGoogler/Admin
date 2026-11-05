import { mkdirSync, writeFileSync } from "node:fs";
import { request } from "@playwright/test";
import { admin, TOKEN_FILE } from "./helpers";

/** One API login per run: the backend allows 10 logins per minute per IP. */
export default async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? "http://localhost:5174";
  const ctx = await request.newContext({ baseURL: base });
  const r = await ctx.post("/api/auth/login", { data: { login: admin.username, password: admin.password } });
  if (!r.ok()) throw new Error(`admin login failed: ${r.status()} ${await r.text()}`);
  const { data } = (await r.json()) as { data: { token: string; expires_at: string } };
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify({ token: data.token, expiresAt: data.expires_at }));
  await ctx.dispose();
}
