import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUI } from "@/test/render";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("translates known statuses and shows unknown ones raw", () => {
    renderUI(
      <>
        <StatusBadge status="published" />
        <StatusBadge status="archived-x" />
      </>,
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("archived-x")).toBeInTheDocument();
  });
});
