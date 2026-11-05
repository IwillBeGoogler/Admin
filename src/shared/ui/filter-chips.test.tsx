import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { FilterChips } from "./filter-chips";
import { SearchInput } from "./search-input";

describe("FilterChips", () => {
  it("each chip removes exactly one filter; Reset all clears", async () => {
    const remove = { tag: vi.fn(), cat: vi.fn() };
    const onReset = vi.fn();
    const { user } = renderUI(
      <FilterChips
        chips={[
          { id: "tag", name: "Tag", value: "#go", onRemove: remove.tag },
          { id: "cat", name: "Category", value: "Docker", onRemove: remove.cat },
        ]}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove filter Tag" }));
    expect(remove.tag).toHaveBeenCalledOnce();
    expect(remove.cat).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reset all" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
  it("renders nothing without filters", () => {
    const { container } = renderUI(<FilterChips chips={[]} />);
    expect(container.querySelector("ul")).toBeNull();
  });
});

describe("SearchInput", () => {
  function Harness() {
    const [v, setV] = useState("abc");
    return <SearchInput aria-label="Search" value={v} onValueChange={setV} />;
  }
  it("clear button empties and refocuses; the / hint shows when empty", async () => {
    const { user } = renderUI(<Harness />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    const box = screen.getByRole("searchbox", { name: "Search" });
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
    expect(screen.getByText("/")).toBeInTheDocument();
  });
});
