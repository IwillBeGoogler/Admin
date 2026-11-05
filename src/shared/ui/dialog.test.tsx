import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { ConfirmDialog } from "./dialog";

function Harness({ onConfirm, confirmText }: { onConfirm: () => unknown; confirmText?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>{open ? "open" : "closed"}</p>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete post?"
        confirmLabel="Delete post"
        cancelLabel="Cancel"
        confirmText={confirmText}
        onConfirm={onConfirm}
      />
    </>
  );
}

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("ConfirmDialog", () => {
  it("focuses Cancel, shows a spinner, sends one request, locks Esc, closes on success", async () => {
    const d = deferred();
    const onConfirm = vi.fn(() => d.promise);
    const { user } = renderUI(<Harness onConfirm={onConfirm} />);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    const confirm = within(dialog).getByRole("button", { name: "Delete post" });
    await user.dblClick(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(confirm.querySelector(".animate-spin")).not.toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    d.resolve();
    await waitFor(() => expect(screen.getByText("closed")).toBeInTheDocument());
  });

  it("stays open with the error inline when the action fails", async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error("db down")));
    const { user } = renderUI(<Harness onConfirm={onConfirm} />);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete post" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("db down");
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete post" })).toBeEnabled();
  });

  it("requires typing the name for high-risk actions", async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const { user } = renderUI(<Harness onConfirm={onConfirm} confirmText="editors" />);
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete post" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type editors to confirm"), "editor");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type editors to confirm"), "s");
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
