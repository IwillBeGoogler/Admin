import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { tokens } from "@/shared/api";
import { adminUser, problem } from "@/test/fixtures";
import { renderUI } from "@/test/render";
import { api, server } from "@/test/server";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("validates required fields without calling the API", async () => {
    const onSignedIn = vi.fn();
    const { user } = renderUI(<LoginPage onSignedIn={onSignedIn} />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findAllByText("Required")).toHaveLength(2);
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("signs in and stores the token", async () => {
    server.use(
      http.post(api("/auth/login"), () =>
        HttpResponse.json({ data: { token: "tok", expires_at: "2030-01-01T00:00:00Z", user: adminUser } }),
      ),
    );
    const onSignedIn = vi.fn();
    const { user } = renderUI(<LoginPage onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("Username or email"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(tokens.get()?.token).toBe("tok");
    tokens.set(null);
  });

  it("shows the server error", async () => {
    server.use(http.post(api("/auth/login"), () => problem(401, "invalid login or password")));
    const { user } = renderUI(<LoginPage onSignedIn={() => {}} />);
    await user.type(screen.getByLabelText("Username or email"), "x");
    await user.type(screen.getByLabelText("Password"), "y");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid login or password");
  });

  it("asks for the 2FA code and completes", async () => {
    server.use(
      http.post(api("/auth/login"), () => HttpResponse.json({ data: { mfa_required: true, mfa_token: "m1" } })),
      http.post(api("/auth/login/2fa"), () =>
        HttpResponse.json({ data: { token: "tok2", expires_at: "2030-01-01T00:00:00Z", user: adminUser } }),
      ),
    );
    const onSignedIn = vi.fn();
    const { user } = renderUI(<LoginPage onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("Username or email"), "admin");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Two-factor authentication")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(tokens.get()?.token).toBe("tok2");
    tokens.set(null);
  });
});
