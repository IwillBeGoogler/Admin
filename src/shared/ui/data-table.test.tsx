import { createColumnHelper } from "@tanstack/react-table";
import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { SortState } from "@/shared/lib/sort";
import { renderUI } from "@/test/render";
import type { Selection } from "./bulk-bar";
import { type Columns, DataTable, type Features } from "./data-table";

interface Row {
  id: number;
  name: string;
  views: number;
}
const col = createColumnHelper<Features, Row>();
const columns: Columns<Row> = [
  col.accessor("name", {
    header: "Name",
    meta: { sortable: true },
    cell: (c) => <a href={`/r/${c.row.original.id}`}>{c.getValue()}</a>,
  }),
  col.accessor("views", { header: "Views", meta: { sortable: true } }),
  col.accessor("id", { header: "Id" }),
];
const data: Row[] = [
  { id: 1, name: "bravo", views: 5 },
  { id: 2, name: "alpha", views: 50 },
  { id: 3, name: "charlie", views: 1 },
  { id: 4, name: "delta", views: 9 },
];

function Harness({ selectable = true }: { selectable?: boolean }) {
  const [sort, setSort] = useState<SortState | undefined>();
  const [selected, setSelected] = useState<Selection>(new Set());
  return (
    <>
      <output aria-label="selection">{[...selected].sort().join(",")}</output>
      <DataTable
        columns={columns}
        data={data}
        caption="Rows"
        getRowId={(r) => String(r.id)}
        sort={sort}
        onSortChange={setSort}
        selectable={selectable}
        canSelect={(r) => r.id !== 4}
        selected={selected}
        onSelectedChange={setSelected}
        rowLabel={(r) => r.name}
        hotkeys
      />
    </>
  );
}

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[1]?.textContent);
const selection = () => screen.getByLabelText("selection").textContent;

describe("DataTable", () => {
  it("sorts by header with aria-sort and the loaded-rows hint", async () => {
    const { user } = renderUI(<Harness />);
    const header = screen.getByRole("columnheader", { name: /Name/ });
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: "Id" })).not.toHaveAttribute("aria-sort");
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(names()).toEqual(["alpha", "bravo", "charlie", "delta"]);
    expect(screen.getByText("Sorted within loaded rows")).toBeInTheDocument();
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["delta", "charlie", "bravo", "alpha"]);
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "none");
  });

  it("selects rows, ranges with Shift, tri-state header, skips unselectable rows", async () => {
    const { user } = renderUI(<Harness />);
    const all = screen.getByRole("checkbox", { name: "Select all rows" }) as HTMLInputElement;
    expect(screen.queryByRole("checkbox", { name: "Select row delta" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Select row bravo" }));
    expect(selection()).toBe("1");
    expect(all.indeterminate).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Select row bravo" }).closest("tr")).toHaveAttribute(
      "data-state",
      "selected",
    );
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("checkbox", { name: "Select row charlie" }));
    await user.keyboard("{/Shift}");
    expect(selection()).toBe("1,2,3");
    expect(all.checked).toBe(true);
    await user.click(all);
    expect(selection()).toBe("");
  });

  it("Space toggles the focused row checkbox", async () => {
    const { user } = renderUI(<Harness />);
    screen.getByRole("checkbox", { name: "Select row alpha" }).focus();
    await user.keyboard(" ");
    expect(selection()).toBe("2");
  });

  it("j j x selects the second row; Enter opens it", async () => {
    renderUI(<Harness />);
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "j" });
    const second = screen.getAllByRole("row")[2] as HTMLElement;
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "x" });
    expect(selection()).toBe("2");
    let opened = "";
    const link = within(second).getByRole("link");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      opened = link.getAttribute("href") ?? "";
    });
    fireEvent.keyDown(second, { key: "Enter" });
    expect(opened).toBe("/r/2");
  });

  it("density toggle persists", async () => {
    const { user, unmount } = renderUI(<Harness selectable={false} />);
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "comfortable");
    await user.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "compact");
    expect(localStorage.getItem("admin.density")).toBe("compact");
    unmount();
    renderUI(<Harness selectable={false} />);
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "compact");
  });
});
