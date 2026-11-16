import { render } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 300 }),
  };
});

import { CategoryChart, DailyChart, TotalsChart, ViewsChart } from "./Charts";

describe("charts", () => {
  it("render with a fixed size and format day ticks as MM-DD", () => {
    const days = Array.from({ length: 6 }, (_, i) => ({ day: `2026-10-0${i + 1}`, dau: i, signups: 1 }));
    const { container } = render(<DailyChart data={days} labels={{ dau: "DAU", signups: "Signups" }} />);
    expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(container.textContent).toContain("10-01");
  });

  it("totals and category charts render their series", () => {
    const data = [
      { name: "Posts", count: 3 },
      { name: "Users", count: 5 },
    ];
    const a = render(<TotalsChart data={data} />);
    expect(a.container.querySelector(".recharts-bar")).not.toBeNull();
    const b = render(<CategoryChart data={data} />);
    expect(b.container.querySelector(".recharts-wrapper")).not.toBeNull();
  });

  it("views chart renders posts, diagrams and pages series", () => {
    const days = Array.from({ length: 4 }, (_, i) => ({
      day: `2026-10-0${i + 1}`,
      posts: i + 1,
      diagrams: i,
      pages: i * 2,
    }));
    const { container } = render(
      <ViewsChart data={days} labels={{ posts: "Posts", diagrams: "Diagrams", pages: "Pages" }} />,
    );
    expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(container.textContent).toContain("10-01");
  });
});
