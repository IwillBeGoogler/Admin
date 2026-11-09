import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { problem, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { CategoriesPage, LabelsPage, TagsPage } from "./TaxonomyPages";

describe("CategoriesPage", () => {
  it("creates and deletes", async () => {
    signIn();
    let cats = [{ id: 1, name: "Docker", count: 3 }];
    server.use(
      http.get(api("/categories"), () => HttpResponse.json({ data: cats })),
      http.post(api("/categories"), async ({ request }) => {
        const { name } = (await request.json()) as { name: string };
        cats = [...cats, { id: 2, name, count: 0 }];
        return HttpResponse.json({ data: cats[1] }, { status: 201 });
      }),
      http.delete(api("/categories/1"), () => {
        cats = cats.filter((c) => c.id !== 1);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<CategoriesPage />);
    await user.type(await screen.findByLabelText("New category"), "Go");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("link", { name: "Go" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete: Docker" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete category" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Docker" })).toBeNull());
    expect(await screen.findByText("Category “Docker” deleted")).toBeInTheDocument();
  });
  it("shows a duplicate-name error from the server", async () => {
    signIn();
    server.use(
      http.get(api("/categories"), () => HttpResponse.json({ data: [] })),
      http.post(api("/categories"), () => problem(409, "category exists")),
    );
    const { user } = await renderRouted(<CategoriesPage />);
    await user.type(await screen.findByLabelText("New category"), "Go");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/category exists \(request req-1\)/)).toBeInTheDocument();
  });
});

describe("LabelsPage", () => {
  it("validates color and creates {name,color}", async () => {
    signIn();
    let body: unknown;
    server.use(
      http.get(api("/labels"), () => HttpResponse.json({ data: [] })),
      http.post(api("/labels"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { id: 1, name: "Hot", color: "#ff0000" } }, { status: 201 });
      }),
    );
    const { user } = await renderRouted(<LabelsPage />);
    await user.type(await screen.findByLabelText("New label"), "Hot");
    const color = screen.getByRole("textbox", { name: "Color" });
    await user.clear(color);
    await user.type(color, "red");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Use a hex color like #3b82f6")).toBeInTheDocument();
    await user.clear(color);
    await user.type(color, "FF0000");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(body).toEqual({ name: "Hot", color: "#ff0000" }));
  });
});

describe("LabelsPage edges", () => {
  it("color picker syncs the text field, falls back to black for bad text, server error shows, delete works", async () => {
    signIn();
    let labels = [{ id: 4, name: "Hot", color: "#ff0000" }];
    server.use(
      http.get(api("/labels"), () => HttpResponse.json({ data: labels })),
      http.post(api("/labels"), () => problem(409, "label exists")),
      http.delete(api("/labels/4"), () => {
        labels = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderRouted(<LabelsPage />);
    await screen.findByRole("link", { name: "Hot" });
    const picker = document.querySelector("input[type=color]") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "#00ff00" } });
    expect(screen.getByRole("textbox", { name: "Color" })).toHaveValue("#00ff00");
    const text = screen.getByRole("textbox", { name: "Color" });
    await user.clear(text);
    await user.type(text, "zz");
    expect(picker.value).toBe("#000000");
    await user.clear(text);
    await user.type(text, "#00ff00");
    await user.type(screen.getByLabelText("New label"), "Hot");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/label exists/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete: Hot" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete label" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Hot" })).toBeNull());
  });

  it("category name is required", async () => {
    signIn();
    server.use(http.get(api("/categories"), () => HttpResponse.json({ data: [] })));
    const { user } = await renderRouted(<CategoriesPage />);
    await user.click(await screen.findByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("TagsPage", () => {
  it("lists tags sorted by count with links to filtered posts", async () => {
    signIn();
    server.use(
      http.get(api("/tags"), () =>
        HttpResponse.json({
          data: [
            { name: "go", count: 1 },
            { name: "qa", count: 4 },
          ],
        }),
      ),
    );
    await renderRouted(<TagsPage />);
    const links = await screen.findAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["#qa4", "#go1"]);
    expect(links[0]).toHaveAttribute("href", "/posts?tag=qa");
  });
});
