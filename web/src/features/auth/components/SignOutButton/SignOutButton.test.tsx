import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./SignOutButton";
import { sessionQueryOptions } from "../../api/sessionQuery";

const renderButton = () => {
  const router = createMemoryRouter([
    { path: "/account", element: <SignOutButton /> },
    { path: "/login", element: <h1>Sign in</h1> },
  ], { initialEntries: ["/account"] });
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryOptions().queryKey, {
    account: {
      createdAt: "2026-08-13T12:00:00.000Z",
      email: "cam@example.com",
      id: "cam",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("SignOutButton", () => {
  it("clears cached private data and returns to login", async () => {
    let finishLogout = (response: Response): void => { void response; };
    const logoutResponse = new Promise<Response>(resolve => { finishLogout = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => logoutResponse));
    const { queryClient, router: navigation } = renderButton();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();
    finishLogout(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/login");
    });
    expect(queryClient.getQueryData(sessionQueryOptions().queryKey)).toBeUndefined();
  });

  it("keeps logout failures visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "server_error", message: "Could not sign out." },
    }), { status: 503 })));
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
  });
});
