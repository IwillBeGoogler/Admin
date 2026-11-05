import { type ColumnDef, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, Rows3Icon, Rows4Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { key } from "@/shared/lib/shortcuts";
import { type SortState, sortRows } from "@/shared/lib/sort";
import { useHotkeys } from "@/shared/lib/useHotkeys";
import { useStoredState } from "@/shared/lib/useStoredState";
import type { Selection } from "./bulk-bar";
import { Button } from "./button";
import { Checkbox } from "./input";
import { Table, TBody, TD, TH, THead, TR } from "./table";

export interface ColMeta {
  /** Header becomes a sort button; rows sort client-side by the column value. */
  sortable?: boolean;
  /** Sort key for display columns or when the cell value is not comparable. */
  sortValue?: (row: never) => unknown;
  className?: string;
}

const features = tableFeatures({ columnMeta: {} as ColMeta });
export type Features = typeof features;
// biome-ignore lint/suspicious/noExplicitAny: column value types differ per column
export type Columns<T extends RowData> = ColumnDef<Features, T, any>[];

export const densities = ["comfortable", "compact"] as const;
export type Density = (typeof densities)[number];

const ariaSort = (s: SortState | undefined, id: string) =>
  s?.id !== id ? "none" : s.desc ? "descending" : "ascending";

function SortIcon({ dir }: { dir: "ascending" | "descending" | "none" }) {
  const Icon = dir === "ascending" ? ArrowUpIcon : dir === "descending" ? ArrowDownIcon : ChevronsUpDownIcon;
  return <Icon className={cn("size-3.5", dir === "none" && "opacity-50")} aria-hidden />;
}

/**
 * Paginated table: rows in, markup out.
 *
 * - Sort: controlled by `sort`/`onSortChange` (URL `sort=field|-field`). The API
 *   has no sort parameter, so rows are sorted within the loaded pages and a hint says so.
 * - Selection: opt-in `selectable`; ids from `getRowId`; Shift+click selects a range.
 * - Keyboard (`hotkeys`): j/k move the row focus, x toggles selection, Enter opens the row's first link.
 * - Density toggle persisted in localStorage["admin.density"].
 */
export function DataTable<T extends RowData>({
  columns,
  data,
  caption,
  getRowId,
  sort,
  onSortChange,
  selectable = false,
  canSelect,
  selected,
  onSelectedChange,
  rowLabel,
  hotkeys = false,
  toolbar = true,
}: {
  columns: Columns<T>;
  data: T[];
  caption?: ReactNode;
  getRowId?: (row: T) => string;
  sort?: SortState | undefined;
  onSortChange?: (s: SortState | undefined) => void;
  selectable?: boolean;
  canSelect?: (row: T) => boolean;
  selected?: Selection;
  onSelectedChange?: (s: Selection) => void;
  rowLabel?: (row: T) => string;
  hotkeys?: boolean;
  toolbar?: boolean;
}) {
  const { t } = useI18n();
  const [density, setDensity] = useStoredState<Density>("admin.density", "comfortable", densities);
  const table = useTable<Features, T>({
    features,
    columns,
    data,
    ...(getRowId ? { getRowId: (r: T) => getRowId(r) } : {}),
  });
  const coreRows = table.getRowModel().rows;
  const rows = sort
    ? sortRows(coreRows, sort, (row, id) => {
        const col = table.getAllLeafColumns().find((c) => c.id === id);
        const sv = col?.columnDef.meta?.sortValue as ((r: T) => unknown) | undefined;
        if (sv) return sv(row.original);
        return col ? row.getValue(id) : undefined;
      })
    : coreRows;

  const sel = selected ?? new Set<string>();
  const selectableRows = selectable ? rows.filter((r) => !canSelect || canSelect(r.original)) : [];
  const selectedCount = selectableRows.filter((r) => sel.has(r.id)).length;
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const headerBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = someSelected;
  }, [someSelected]);
  const anchor = useRef<number | null>(null);

  const toggle = (index: number, range: boolean) => {
    const row = rows[index];
    if (!row || !onSelectedChange || (canSelect && !canSelect(row.original))) return;
    const next = new Set(sel);
    const on = !sel.has(row.id);
    const from = range && anchor.current !== null ? Math.min(anchor.current, index) : index;
    const to = range && anchor.current !== null ? Math.max(anchor.current, index) : index;
    for (let i = from; i <= to; i++) {
      const r = rows[i];
      if (!r || (canSelect && !canSelect(r.original))) continue;
      if (on) next.add(r.id);
      else next.delete(r.id);
    }
    anchor.current = index;
    onSelectedChange(next);
  };

  const [active, setActive] = useState(-1);
  const body = useRef<HTMLTableSectionElement>(null);
  const focusRow = (i: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setActive(n);
    const tr = body.current?.querySelectorAll<HTMLTableRowElement>(":scope > tr")[n];
    tr?.focus();
    tr?.scrollIntoView?.({ block: "nearest" });
  };
  useHotkeys(
    {
      [key("nextRow")]: () => focusRow(active + 1),
      [key("prevRow")]: () => focusRow(active < 0 ? 0 : active - 1),
      [key("toggleRow")]: selectable ? () => active >= 0 && toggle(active, false) : null,
      [key("openRow")]: (e) => {
        if (active < 0 || !(e.target instanceof HTMLTableRowElement)) return;
        body.current?.querySelectorAll<HTMLTableRowElement>(":scope > tr")[active]?.querySelector("a")?.click();
      },
    },
    hotkeys && rows.length > 0,
  );

  const leaf = table.getAllLeafColumns();
  const hasSortable = leaf.some((c) => c.columnDef.meta?.sortable);
  return (
    <>
      {toolbar ? (
        <div className="flex min-h-10 flex-wrap items-center justify-end gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
          {sort && hasSortable ? <p className="mr-auto">{t("list.sortedLoaded")}</p> : null}
          <fieldset className="flex items-center gap-0.5">
            <legend className="sr-only">{t("list.density")}</legend>
            {densities.map((d) => {
              const Icon = d === "compact" ? Rows4Icon : Rows3Icon;
              return (
                <Button
                  key={d}
                  variant={density === d ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  aria-pressed={density === d}
                  onClick={() => setDensity(d)}
                >
                  <Icon aria-hidden />
                  <span className="max-sm:sr-only">{t(`list.${d}`)}</span>
                </Button>
              );
            })}
          </fieldset>
        </div>
      ) : null}
      <Table data-density={density}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <THead>
          {table.getHeaderGroups().map((hg) => (
            <TR key={hg.id} className="hover:bg-transparent">
              {selectable ? (
                <TH className="w-10">
                  <Checkbox
                    ref={headerBox}
                    aria-label={t("list.selectAll")}
                    checked={allSelected}
                    disabled={selectableRows.length === 0}
                    onChange={() =>
                      onSelectedChange?.(
                        allSelected
                          ? new Set([...sel].filter((id) => !selectableRows.some((r) => r.id === id)))
                          : new Set([...sel, ...selectableRows.map((r) => r.id)]),
                      )
                    }
                  />
                </TH>
              ) : null}
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta;
                const dir = ariaSort(sort, h.column.id);
                const content = h.isPlaceholder ? null : <table.FlexRender header={h} />;
                if (!meta?.sortable || !onSortChange)
                  return (
                    <TH key={h.id} className={meta?.className}>
                      {content}
                    </TH>
                  );
                return (
                  <TH key={h.id} aria-sort={dir} className={meta.className}>
                    <button
                      type="button"
                      className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        onSortChange(
                          sort?.id !== h.column.id
                            ? { id: h.column.id, desc: false }
                            : sort.desc
                              ? undefined
                              : { id: h.column.id, desc: true },
                        )
                      }
                    >
                      {content}
                      <SortIcon dir={dir} />
                    </button>
                  </TH>
                );
              })}
            </TR>
          ))}
        </THead>
        <TBody ref={body}>
          {rows.map((row, i) => {
            const isSel = selectable && sel.has(row.id);
            const can = !canSelect || canSelect(row.original);
            return (
              <TR
                key={row.id}
                tabIndex={hotkeys ? -1 : undefined}
                data-state={isSel ? "selected" : undefined}
                data-active={active === i || undefined}
                onFocus={hotkeys ? (e) => e.target === e.currentTarget && setActive(i) : undefined}
                className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[active]:bg-muted/40"
              >
                {selectable ? (
                  <TD className="w-10">
                    {can ? (
                      <Checkbox
                        aria-label={t("list.selectRow", { name: rowLabel ? rowLabel(row.original) : row.id })}
                        checked={isSel}
                        readOnly
                        onClick={(e) => toggle(i, e.shiftKey)}
                      />
                    ) : null}
                  </TD>
                ) : null}
                {row.getAllCells().map((cell) => (
                  <TD key={cell.id} className={cell.column.columnDef.meta?.className}>
                    <table.FlexRender cell={cell} />
                  </TD>
                ))}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </>
  );
}
