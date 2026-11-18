import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { SeriesRow } from "../domain/insights";
import type { Counted } from "../domain/stats";

/** True when the viewer asked for less motion. */
export const prefersReducedMotion = (win: Pick<Window, "matchMedia"> | undefined = globalThis.window) =>
  Boolean(win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** Charts animate in unless the viewer asked for less motion; tests stay static. */
export const canAnimate = (mode: string, reduced: boolean) => mode !== "test" && !reduced;

const animate = canAnimate(import.meta.env.MODE, prefersReducedMotion());

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--foreground)",
  },
};

/** Vertical bars; parent reserves the height so nothing shifts on load. */
export function TotalsChart({ data }: { data: Counted[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: "var(--muted)" }} {...tooltip} />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }: { data: Counted[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: "var(--muted)" }} {...tooltip} />
        <Bar
          dataKey="count"
          fill="var(--chart-2)"
          radius={[0, 6, 6, 0]}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Daily series (DAU, signups) as two areas over the same days. */
export function DailyChart({
  data,
  labels,
}: {
  data: { day: string; dau: number; signups: number }[];
  labels: { dau: string; signups: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...tooltip} />
        <Area
          type="monotone"
          dataKey="dau"
          name={labels.dau}
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.15}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="signups"
          name={labels.signups}
          stroke="var(--chart-2)"
          fill="var(--chart-2)"
          fillOpacity={0.15}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Daily views of posts, diagrams and pages over the same days. */
export function ViewsChart({
  data,
  labels,
}: {
  data: { day: string; posts: number; diagrams: number; pages: number }[];
  labels: { posts: string; diagrams: string; pages: string };
}) {
  const axis = { fill: "var(--muted-foreground)", fontSize: 12 };
  const area = (key: "posts" | "diagrams" | "pages", color: string) => (
    <Area
      type="monotone"
      dataKey={key}
      name={labels[key]}
      stroke={color}
      fill={color}
      fillOpacity={0.15}
      isAnimationActive={animate}
      animationDuration={900}
      animationEasing="ease-out"
    />
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: string) => d.slice(5)}
          tick={axis}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip {...tooltip} />
        {area("posts", "var(--chart-1)")}
        {area("diagrams", "var(--chart-2)")}
        {area("pages", "var(--chart-3)")}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Any number of daily series over the same days; `series` maps a data key to its legend label. */
export function SeriesChart({ data, series }: { data: SeriesRow[]; series: Record<string, string> }) {
  const axis = { fill: "var(--muted-foreground)", fontSize: 12 };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: string) => d.slice(5)}
          tick={axis}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip {...tooltip} />
        {Object.entries(series).map(([key, label], i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={label}
            stroke={colors[i % colors.length]}
            fill={colors[i % colors.length]}
            fillOpacity={0.15}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

const axis = { fill: "var(--muted-foreground)", fontSize: 12 };
const dayTick = (d: string) => d.slice(5);

/** Share of a whole as a ring; `data` is name + count. */
export function DonutChart({ data }: { data: Counted[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip {...tooltip} />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="var(--card)"
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={colors[i % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Daily lines (not filled) so two close series stay readable, e.g. opened vs resolved. */
export function LinesChart({ data, series }: { data: SeriesRow[]; series: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayTick} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip {...tooltip} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        {Object.entries(series).map(([key, label], i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={label}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Daily bars stacked per series, e.g. created vs published per day. */
export function StackedBarsChart({ data, series }: { data: SeriesRow[]; series: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayTick} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} {...tooltip} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {Object.entries(series).map(([key, label], i) => (
          <Bar
            key={key}
            dataKey={key}
            name={label}
            stackId="a"
            fill={colors[i % colors.length]}
            isAnimationActive={animate}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bars sorted high to low plus the running share line (Pareto). */
export function ParetoChart({
  data,
  labels,
}: {
  data: { name: string; count: number; cum: number }[];
  labels: { count: string; cum: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} height={36} />
        <YAxis yAxisId="n" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="p"
          orientation="right"
          domain={[0, 100]}
          unit="%"
          tick={axis}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: "var(--muted)" }} {...tooltip} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="n"
          dataKey="count"
          name={labels.count}
          fill="var(--chart-1)"
          radius={[6, 6, 0, 0]}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
        <Line
          yAxisId="p"
          type="monotone"
          dataKey="cum"
          name={labels.cum}
          stroke="var(--chart-3)"
          strokeWidth={2}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** One dot per post: likes (x) against comments (y). */
export function ScatterPlot({
  data,
  labels,
}: {
  data: { title: string; likes: number; comments: number }[];
  labels: { x: string; y: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" dataKey="likes" name={labels.x} allowDecimals={false} tick={axis} tickLine={false} />
        <YAxis type="number" dataKey="comments" name={labels.y} allowDecimals={false} tick={axis} tickLine={false} />
        <ZAxis range={[70, 70]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltip} />
        <Scatter
          data={data}
          fill="var(--chart-2)"
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Tiny trend line for a KPI tile: no axes, no tooltip. */
export function Sparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.15}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={animate}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type TreeNode = { name: string; size: number };

function TreeCell(props: { x?: number; y?: number; width?: number; height?: number; index?: number; name?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, name = "" } = props;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colors[index % colors.length]}
        stroke="var(--card)"
        strokeWidth={2}
        rx={4}
      />
      {width > 56 && height > 22 ? (
        <text x={x + 8} y={y + 18} fill="var(--card)" fontSize={12} fontWeight={600}>
          {name}
        </text>
      ) : null}
    </g>
  );
}

/** Area per item, sized by count. */
export function TreemapChart({ data }: { data: Counted[] }) {
  const nodes: TreeNode[] = data.map((d) => ({ name: d.name, size: d.count }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={nodes}
        dataKey="size"
        nameKey="name"
        content={<TreeCell />}
        isAnimationActive={animate}
        animationDuration={900}
        animationEasing="ease-out"
      >
        <Tooltip {...tooltip} />
      </Treemap>
    </ResponsiveContainer>
  );
}

/** Colour-intensity grid; intensity is relative to the largest cell. */
export function HeatGrid({
  rows,
  cols,
}: {
  rows: { label: string; values: number[] }[];
  /** Column header text, one per column; empty strings leave a header blank. */
  cols: string[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px text-[10px]"
        style={{ gridTemplateColumns: `3.5rem repeat(${cols.length}, minmax(0.9rem, 1fr))` }}
      >
        <span />
        {cols.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: headers can repeat or be blank
          <span key={i} className="truncate text-center text-muted-foreground">
            {c}
          </span>
        ))}
        {rows.map((r, ri) => (
          <HeatRow key={r.label} label={r.label} row={ri} cols={cols} cells={r.values} max={max} />
        ))}
      </div>
    </div>
  );
}

function HeatRow({
  label,
  row,
  cols,
  cells,
  max,
}: {
  label: string;
  row: number;
  cols: string[];
  cells: number[];
  max: number;
}) {
  return (
    <>
      <span className="truncate pr-1 text-right text-muted-foreground">{label}</span>
      {cells.map((v, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
          key={i}
          title={`${label} ${cols[i]}: ${v}`}
          className="viz-pop aspect-square min-h-4 rounded-sm bg-[var(--chart-1)] hover:ring-2 hover:ring-ring"
          style={{
            opacity: 0.06 + 0.94 * (v / max) ** 0.6,
            animationDelay: `${Math.min(row * 25 + i * 12, 600)}ms`,
          }}
        />
      ))}
    </>
  );
}

/** Half-ring gauge of `value` against `max`; turns amber over `warn` and red over `max`. */
export function Gauge({ value, max, warn, text }: { value: number; max: number; warn: number; text: string }) {
  const ratio = max ? Math.min(value / max, 1) : 0;
  const color = value > max ? "var(--destructive)" : value > warn ? "var(--chart-3)" : "var(--chart-1)";
  const arc = Math.PI * 40;
  return (
    <svg viewBox="0 0 100 58" className="mx-auto w-full max-w-56" role="img" aria-label={text}>
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="var(--muted)" strokeWidth={10} strokeLinecap="round" />
      <path
        d="M10 50 A40 40 0 0 1 90 50"
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${arc * ratio} ${arc}`}
        style={{ transition: "stroke-dasharray 900ms ease-out" }}
      />
      <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">
        {text}
      </text>
    </svg>
  );
}

/** Closed shape over a few categories, e.g. activity by weekday. */
export function RadarShape({ data, label }: { data: { name: string; count: number }[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="name" tick={axis} />
        <Tooltip {...tooltip} />
        <Radar
          dataKey="count"
          name={label}
          stroke="var(--chart-2)"
          fill="var(--chart-2)"
          fillOpacity={0.25}
          isAnimationActive={animate}
          animationDuration={900}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
