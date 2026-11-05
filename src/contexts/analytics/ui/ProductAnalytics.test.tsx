import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { signIn } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { ProductAnalytics } from "./ProductAnalytics";

describe("ProductAnalytics", () => {
  it("shows active users, funnel and retention", async () => {
    signIn();
    localStorage.setItem("admin.locale", "en");
    server.use(
      http.get(api("/admin/analytics"), ({ request }) => {
        expect(new URL(request.url).searchParams.get("days")).toBe("30");
        return HttpResponse.json({
          data: {
            days: 30,
            dau: [{ day: "2026-10-06", count: 12 }],
            wau: 30,
            mau: 48,
            signups: [{ day: "2026-10-06", count: 3 }],
            avg_read_seconds: 95,
            total_read_hours: 4.2,
            funnel: [
              { step: "visit", count: 100 },
              { step: "signup_open", count: 20 },
              { step: "signup", count: 5 },
              { step: "first_publish", count: 1 },
            ],
            retention: { cohort: 5, d1: 0.4, d7: 0.2, d30: 0 },
            top_paths: [{ key: "/", count: 80 }],
            languages: [{ key: "uz", count: 60 }],
          },
        });
      }),
    );
    renderUI(<ProductAnalytics />);
    expect(await screen.findByText("1m 35s")).toBeInTheDocument();
    expect(screen.getByText("DAU/MAU 25%")).toBeInTheDocument();
    expect(screen.getByText("25% of previous step")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("5 new users in period")).toBeInTheDocument();
  });

  it("explains an empty report", async () => {
    signIn();
    localStorage.setItem("admin.locale", "en");
    server.use(http.get(api("/admin/analytics"), () => HttpResponse.json({ data: { days: 30, mau: 0, funnel: [] } })));
    renderUI(<ProductAnalytics />);
    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });
});
