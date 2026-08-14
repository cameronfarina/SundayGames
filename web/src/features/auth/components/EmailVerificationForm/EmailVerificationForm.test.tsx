import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailVerificationForm } from "./EmailVerificationForm";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

const mountForm = () => {
  const router = createMemoryRouter([{
    path: "/verify-email",
    element: (
      <EmailVerificationForm
        initialEmail="cam@example.com"
        returnTo="/league"
        token="verify-token"
      />
    ),
  }, { path: "/login", element: <p>Login</p> }], { initialEntries: ["/verify-email"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("EmailVerificationForm", () => {
  it("establishes the mailbox-proven password and returns to login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ verified: true })));
    const router = mountForm();
    await userEvent.type(screen.getByLabelText("Choose password"), "mailbox proven password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "mailbox proven password{Enter}");
    await waitFor(() => { expect(router.state.location.pathname).toBe("/login"); });
    expect(router.state.location.search).toBe("?emailVerified=1&returnTo=%2Fleague");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      token: "verify-token",
      newPassword: "mailbox proven password",
      newPasswordConfirmation: "mailbox proven password",
    }));
  });

  it("offers a fresh verification link after an expired token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_or_expired_token", message: "This link is invalid or has expired." },
    }, 400)));
    mountForm();
    await userEvent.type(screen.getByLabelText("Choose password"), "mailbox proven password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "mailbox proven password{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("cam@example.com");
  });
});
