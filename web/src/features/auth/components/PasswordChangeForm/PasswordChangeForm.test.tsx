import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChangeForm } from "./PasswordChangeForm";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);
const Provider = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const mountForm = () => {
  const router = createMemoryRouter([
    { path: "/account", element: <PasswordChangeForm /> },
    { path: "/login", element: <h1>Sign in</h1> },
  ], { initialEntries: ["/account"] });
  render(<Provider><RouterProvider router={router} /></Provider>);
  return router;
};
const fillForm = async () => {
  await userEvent.type(screen.getByLabelText("Current password"), "secure password");
  await userEvent.type(screen.getByLabelText("New password"), "replacement password");
  await userEvent.type(screen.getByLabelText("Confirm new password"), "replacement password");
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("PasswordChangeForm", () => {
  it("changes the password on Enter and returns to login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return jsonResponse({ ok: true });
    }));
    const navigation = mountForm();
    const currentPassword = screen.getByLabelText("Current password");
    const newPassword = screen.getByLabelText("New password");
    expect(newPassword).toHaveAttribute("minlength", "15");
    expect(screen.getByText(
      "Use at least 15 characters. A passphrase of 4 memorable words works well.",
    )).toBeVisible();
    expect(newPassword).toHaveAccessibleDescription(
      "Use at least 15 characters. A passphrase of 4 memorable words works well.",
    );
    expect(currentPassword).not.toHaveAccessibleDescription();
    await fillForm();
    await userEvent.type(screen.getByLabelText("Confirm new password"), "{Enter}");
    expect(screen.getByRole("button", { name: "Updating password..." })).toBeDisabled();
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/login");
    });
    expect(navigation.state.location.search).toBe("?passwordChanged=1");
  });

  it("preserves a helpful current-password error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_current_password", message: "Current password is incorrect." },
    }, 403)));
    mountForm();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
  });
});
