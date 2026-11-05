import { HttpResponse, http } from "msw";
import { tokens } from "@/shared/api";
import { api, server } from "./server";

export const adminUser = {
  id: 3,
  username: "admin",
  email: "admin@x.dev",
  email_verified: true,
  display_name: "",
  bio: "",
  avatar_url: "",
  roles: ["super_admin"],
  created_at: "2026-10-05T08:39:30Z",
};

/** Signed-in admin with the given permissions (or wildcard). */
export function signIn(perms: string[] | "all" = "all") {
  tokens.set({ token: "test-token", expiresAt: "2030-01-01T00:00:00Z" });
  const role =
    perms === "all"
      ? { name: "super_admin", wildcard: true, permissions: [] }
      : {
          name: "custom",
          wildcard: false,
          permissions: perms.map((p) => ({ resource: p.split(".")[0], action: p.split(".")[1] })),
        };
  server.use(
    http.get(api("/me"), () => HttpResponse.json({ data: adminUser })),
    http.get(api("/guard/auth/me"), () => HttpResponse.json({ data: { roles: [role] } })),
  );
}

export const page = <T>(items: T[], meta: Record<string, unknown> = {}) =>
  HttpResponse.json({ data: items, meta: { page: 1, limit: 20, total: items.length, has_more: false, ...meta } });

export const problem = (status: number, detail: string) =>
  HttpResponse.json({ type: "about:blank", title: detail, status, detail, request_id: "req-1" }, { status });

export const report = (o: Record<string, unknown> = {}) => ({
  id: 7,
  reporter_id: 2,
  reporter: "ali",
  target_type: "post",
  target_id: 4,
  reason: "spam",
  note: "buy now",
  status: "open",
  resolved_by: 0,
  created_at: "2030-01-01T00:00:00Z",
  reports: 1,
  ...o,
});

export const post = (o: Record<string, unknown> = {}) => ({
  id: 4,
  title: "QA probe",
  subtitle: "",
  slug: "qa",
  status: "published",
  body: "body",
  reading_time: 1,
  published_at: "2026-10-05T14:59:34Z",
  author: "admin",
  category_id: 1,
  publication_id: 0,
  user_id: 3,
  cover_url: "",
  canonical_url: "",
  tags: ["qa"],
  labels: [],
  likes: 0,
  claps: 0,
  comments_count: 0,
  views: 12,
  liked: false,
  my_claps: 0,
  bookmarked: false,
  created_at: "2026-10-05T14:59:34Z",
  updated_at: "2026-10-05T14:59:34Z",
  ...o,
});

export const diagramProject = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Payments",
  owner: { id: "2", username: "ali" },
  files: 3,
  updated_at: "2030-01-01T00:00:00Z",
  thumbnail_url: null,
  shared: true,
  ...o,
});

export const diagramTemplate = (o: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "URL shortener",
  kind: "system",
  description: "Classic",
  file_id: "f1",
  published: true,
  position: 1,
  ...o,
});

export const clientError = (o: Record<string, unknown> = {}) => ({
  id: 5,
  message: "Cannot read properties of undefined",
  stack: "TypeError: x\n  at render",
  page_url: "https://blog.test/p/a",
  user_agent: "Mozilla/5.0",
  count: 7,
  status: "open",
  first_seen: "2030-01-01T00:00:00Z",
  last_seen: "2030-01-02T00:00:00Z",
  ...o,
});

export const feedback = (o: Record<string, unknown> = {}) => ({
  id: 3,
  user_id: 0,
  username: "",
  kind: "bug",
  message: "login is broken",
  contact_email: "me@example.com",
  page_url: "https://blog.test/login",
  user_agent: "Mozilla/5.0",
  app_version: "",
  error_message: "boom",
  error_stack: "Error: boom\n  at x",
  status: "open",
  resolved_by: 0,
  created_at: "2030-01-01T00:00:00Z",
  ...o,
});
