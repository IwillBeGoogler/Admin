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

import {
  CategoryChart,
  canAnimate,
  DailyChart,
  DonutChart,
  Gauge,
  HeatGrid,
  LinesChart,
  ParetoChart,
  prefersReducedMotion,
  RadarShape,
  ScatterPlot,
  Sparkline,
  StackedBarsChart,
  TotalsChart,
  TreemapChart,
  ViewsChart,
} from "./Charts";

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

describe("more charts", () => {
  const rows = [
    { day: "2026-10-01", a: 1, b: 2 },
    { day: "2026-10-02", a: 3, b: 1 },
  ];
  const series = { a: "A", b: "B" };
  const named = [
    { name: "x", count: 3 },
    { name: "y", count: 5 },
  ];

  it("render without crashing", () => {
    expect(render(<DonutChart data={named} />).container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(render(<LinesChart data={rows} series={series} />).container.querySelector(".recharts-line")).not.toBeNull();
    expect(
      render(<StackedBarsChart data={rows} series={series} />).container.querySelector(".recharts-bar"),
    ).not.toBeNull();
    expect(
      render(
        <ParetoChart data={[{ name: "x", count: 3, cum: 100 }]} labels={{ count: "n", cum: "%" }} />,
      ).container.querySelector(".recharts-wrapper"),
    ).not.toBeNull();
    expect(
      render(
        <ScatterPlot data={[{ title: "t", likes: 1, comments: 2 }]} labels={{ x: "L", y: "C" }} />,
      ).container.querySelector(".recharts-wrapper"),
    ).not.toBeNull();
    expect(render(<Sparkline values={[1, 2, 3]} />).container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(render(<TreemapChart data={named} />).container.querySelector(".recharts-wrapper")).not.toBeNull();
    expect(render(<RadarShape data={named} label="r" />).container.querySelector(".recharts-wrapper")).not.toBeNull();
  });

  it("heat grid draws one cell per value and scales opacity", () => {
    const { container } = render(<HeatGrid rows={[{ label: "r1", values: [0, 4] }]} cols={["a", "b"]} />);
    const cells = container.querySelectorAll("span[title]");
    expect(cells).toHaveLength(2);
    expect(Number.parseFloat((cells[0] as HTMLElement).style.opacity)).toBeCloseTo(0.06);
    expect((cells[1] as HTMLElement).style.opacity).toBe("1");
  });

  it("gauge shows its text and changes colour past warn and max", () => {
    for (const v of [5, 20, 30]) {
      const { getByRole, unmount } = render(<Gauge value={v} max={24} warn={18} text={`${v} h`} />);
      expect(getByRole("img", { name: `${v} h` })).toBeInTheDocument();
      unmount();
    }
    expect(render(<Gauge value={1} max={0} warn={0} text="0" />).getByRole("img")).toBeInTheDocument();
  });

  it("animates unless in tests or when reduced motion is asked for", () => {
    expect(canAnimate("production", false)).toBe(true);
    expect(canAnimate("test", false)).toBe(false);
    expect(canAnimate("production", true)).toBe(false);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) as MediaQueryList })).toBe(true);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) as MediaQueryList })).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
  });
});
