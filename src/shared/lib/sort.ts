/** Column sort as stored in the URL: `sort=field` (ascending) or `sort=-field` (descending). */
export interface SortState {
  id: string;
  desc: boolean;
}

export const parseSort = (s: string | undefined): SortState | undefined => {
  if (!s) return undefined;
  const desc = s.startsWith("-");
  const id = desc ? s.slice(1) : s;
  return id ? { id, desc } : undefined;
};

export const serializeSort = (s: SortState | undefined): string | undefined =>
  s ? `${s.desc ? "-" : ""}${s.id}` : undefined;

/** none -> ascending -> descending -> none. */
export const nextSort = (current: SortState | undefined, id: string): SortState | undefined => {
  if (current?.id !== id) return { id, desc: false };
  return current.desc ? undefined : { id, desc: true };
};

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

/** Total order for cell values; empty values always sort last. */
export const compareValues = (a: unknown, b: unknown): number => {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (Array.isArray(a) || Array.isArray(b)) return compareValues(String(a), String(b));
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/** Stable client-side sort; empty values stay last in both directions. */
export function sortRows<T>(rows: readonly T[], sort: SortState | undefined, value: (row: T, id: string) => unknown) {
  if (!sort) return [...rows];
  return rows
    .map((row, i) => ({ row, i, v: value(row, sort.id) }))
    .sort((x, y) => {
      if (isEmpty(x.v) !== isEmpty(y.v)) return isEmpty(x.v) ? 1 : -1;
      const c = compareValues(x.v, y.v);
      return (sort.desc ? -c : c) || x.i - y.i;
    })
    .map((x) => x.row);
}
